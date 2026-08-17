import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Credenciales de firma de publicación.
//
// Viven en android/key.properties, que NO está en el control de versiones: el
// almacén de claves y su contraseña son secretos, y además irrecuperables.
// Google Play liga la aplicación a esa clave para siempre; si se pierde, no se
// puede volver a publicar una actualización — hay que publicar una aplicación
// nueva y pedirle a cada usuario que la instale de cero.
//
// Si el archivo no existe, la compilación de release sigue funcionando con la
// clave de depuración. Eso permite probar el APK localmente sin tener el
// secreto, pero el resultado NO es publicable. Ver android/FIRMA.md.
val propsFirma = Properties()
val archivoFirma = rootProject.file("key.properties")
val hayFirmaReal = archivoFirma.exists()
if (hayFirmaReal) {
    propsFirma.load(FileInputStream(archivoFirma))
}

android {
    namespace = "app.remata.remata_movil"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "app.remata.remata_movil"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hayFirmaReal) {
            create("release") {
                keyAlias = propsFirma["keyAlias"] as String
                keyPassword = propsFirma["keyPassword"] as String
                storeFile = file(propsFirma["storeFile"] as String)
                storePassword = propsFirma["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hayFirmaReal) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }
}

// Sin clave de publicación, la compilación de release FALLA.
//
// La alternativa —compilar y avisar— se probó y no sirve: Flutter filtra la
// salida de Gradle y el aviso no llega a verse. Quedaría un archivo con
// aspecto de publicable que Google Play rechaza, y eso se descubre al subirlo,
// que es el peor momento.
//
// Para probar en local sin tener el secreto:
//   flutter build apk --release --android-project-arg=permitirFirmaDepuracion=true
if (!hayFirmaReal &&
    !project.hasProperty("permitirFirmaDepuracion") &&
    gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
) {
    throw GradleException(
        """

        No existe android/key.properties, así que no hay clave de publicación.

        Un archivo de release firmado con la clave de depuración se instala y
        se prueba, pero Google Play lo RECHAZA. Para no entregar algo que
        parece listo y no lo está, esta compilación se detiene aquí.

        Para publicar de verdad:  ver android/FIRMA.md
        Para probar en local:     añadir
                                  --android-project-arg=permitirFirmaDepuracion=true
        """.trimIndent()
    )
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
