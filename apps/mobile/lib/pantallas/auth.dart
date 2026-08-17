import 'package:flutter/material.dart';
import '../datos/api.dart';
import '../datos/repositorio.dart';
import '../design/tokens.dart';

/// Registro e inicio de sesión en una sola pantalla, alternable.
///
/// Corresponde a la pantalla 6 del capítulo de bienvenida. Las opciones de
/// Google y Apple del mockup no están: exigen configuración de proveedores
/// externos que aún no existe, y mostrarlas sin funcionar sería peor que
/// omitirlas.
class PantallaAuth extends StatefulWidget {
  const PantallaAuth({super.key, required this.repo, required this.alEntrar});

  final Repositorio repo;
  final VoidCallback alEntrar;

  @override
  State<PantallaAuth> createState() => _PantallaAuthState();
}

class _PantallaAuthState extends State<PantallaAuth> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _nombre = TextEditingController();

  bool _registrando = false;
  bool _comercio = false;
  bool _cargando = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _nombre.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _cargando = true;
      _error = null;
    });

    try {
      if (_registrando) {
        await widget.repo.registrar(
          email: _email.text.trim(),
          password: _password.text,
          nombre: _nombre.text.trim(),
          comercio: _comercio,
        );
      } else {
        final entro = await widget.repo.iniciarSesion(
          email: _email.text.trim(),
          password: _password.text,
        );
        if (!entro) {
          // Cuenta con segundo factor: el flujo de administradores no está en
          // esta app de comprador. Se dice explícitamente en lugar de fallar.
          setState(() {
            _error = 'Esta cuenta requiere verificación en dos pasos, '
                'disponible en el panel de administración.';
            _cargando = false;
          });
          return;
        }
      }
      if (mounted) widget.alEntrar();
    } on ApiExcepcion catch (e) {
      setState(() {
        _error = e.mensaje;
        _cargando = false;
      });
    } catch (_) {
      setState(() {
        _error = 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
        _cargando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(RTokens.s6),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Marca(),
                    const SizedBox(height: RTokens.s8),
                    Text(
                      _registrando ? 'Crea tu cuenta' : 'Bienvenido de vuelta',
                      style: RTokens.displayL,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: RTokens.s2),
                    Text(
                      _registrando
                          ? (_comercio
                              ? 'Vende lo que te sobra antes de que se pierda.'
                              : 'Empieza a ahorrar y a evitar desperdicio.')
                          : 'Entra para ver las ofertas cerca de ti.',
                      style: RTokens.body,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: RTokens.s6),

                    if (_registrando) ...[
                      // El tipo de cuenta se elige una sola vez y no se puede
                      // cambiar después, así que se pregunta antes de nada.
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment(
                            value: false,
                            icon: Icon(Icons.shopping_bag_outlined, size: 18),
                            label: Text('Quiero comprar'),
                          ),
                          ButtonSegment(
                            value: true,
                            icon: Icon(Icons.storefront_outlined, size: 18),
                            label: Text('Tengo un comercio'),
                          ),
                        ],
                        selected: {_comercio},
                        onSelectionChanged: (s) =>
                            setState(() => _comercio = s.first),
                      ),
                      const SizedBox(height: RTokens.s4),
                      TextFormField(
                        controller: _nombre,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(
                          hintText: _comercio
                              ? 'Nombre de tu comercio'
                              : 'Tu nombre',
                          prefixIcon: Icon(_comercio
                              ? Icons.storefront_outlined
                              : Icons.person_outline),
                        ),
                        validator: (v) {
                          // Para un comercio el nombre no es decorativo: pasa a
                          // ser su razón social en el alta.
                          if (_comercio && (v?.trim().isEmpty ?? true)) {
                            return 'Escribe el nombre de tu comercio';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: RTokens.s3),
                    ],

                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(
                        hintText: 'Correo electrónico',
                        prefixIcon: Icon(Icons.mail_outline),
                      ),
                      validator: (v) {
                        final t = v?.trim() ?? '';
                        if (t.isEmpty) return 'Escribe tu correo';
                        if (!t.contains('@') || !t.contains('.')) {
                          return 'Ese correo no parece válido';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: RTokens.s3),

                    TextFormField(
                      controller: _password,
                      obscureText: true,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _enviar(),
                      decoration: const InputDecoration(
                        hintText: 'Contraseña',
                        prefixIcon: Icon(Icons.lock_outline),
                      ),
                      validator: (v) {
                        if ((v ?? '').isEmpty) return 'Escribe tu contraseña';
                        // El backend exige 10 caracteres; avisarlo acá evita un
                        // viaje de ida y vuelta para descubrirlo.
                        if (_registrando && v!.length < 10) {
                          return 'Usa al menos 10 caracteres';
                        }
                        return null;
                      },
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: RTokens.s4),
                      Container(
                        padding: const EdgeInsets.all(RTokens.s3),
                        decoration: BoxDecoration(
                          color: RTokens.dangerSoft,
                          borderRadius:
                              BorderRadius.circular(RTokens.radiusMd),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline,
                                color: RTokens.danger, size: 20),
                            const SizedBox(width: RTokens.s2),
                            Expanded(
                              child: Text(
                                _error!,
                                style: RTokens.bodySm
                                    .copyWith(color: RTokens.danger),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: RTokens.s5),
                    ElevatedButton(
                      onPressed: _cargando ? null : _enviar,
                      child: _cargando
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(_registrando ? 'Crear cuenta' : 'Ingresar'),
                    ),
                    const SizedBox(height: RTokens.s3),
                    TextButton(
                      onPressed: _cargando
                          ? null
                          : () => setState(() {
                                _registrando = !_registrando;
                                _error = null;
                              }),
                      child: Text(
                        _registrando
                            ? '¿Ya tienes cuenta? Inicia sesión'
                            : '¿No tienes cuenta? Crea una',
                        style: const TextStyle(
                          color: RTokens.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Marca extends StatelessWidget {
  const _Marca();

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: RTokens.primary,
              borderRadius: BorderRadius.circular(RTokens.radiusLg),
            ),
            child: const Icon(Icons.sell_outlined,
                color: Colors.white, size: 34),
          ),
          const SizedBox(height: RTokens.s3),
          const Text('REMATA',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                letterSpacing: 1,
                color: RTokens.textStrong,
              )),
          const Text('Ahorra más. Desperdicia menos.',
              style: TextStyle(
                fontSize: 12,
                color: RTokens.accent,
                fontWeight: FontWeight.w600,
              )),
        ],
      );
}
