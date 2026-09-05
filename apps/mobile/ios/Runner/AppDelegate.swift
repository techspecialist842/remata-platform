import Flutter
import UIKit
import GoogleMaps

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // La clave de Google Maps entra por Info.plist, que a su vez la toma de
    // ios/Flutter/Mapas.xcconfig — un archivo fuera del control de versiones,
    // igual que android/mapas.properties.
    //
    // Si no hay clave no se llama al SDK. Es deliberado: llamarlo con una
    // clave vacía hace que el SDK aborte el proceso al arrancar, y una app que
    // no abre es mucho peor que una app sin mapa.
    //
    // En ese caso el mapa sale gris y vacío. El resto funciona igual.
    if let clave = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String,
       !clave.isEmpty,
       clave != "$(MAPS_API_KEY)" {
      GMSServices.provideAPIKey(clave)
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
