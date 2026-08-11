import 'package:flutter/material.dart';
import 'datos/api.dart';
import 'datos/repositorio.dart';
import 'design/tema.dart';
import 'design/tokens.dart';
import 'pantallas/auth.dart';
import 'pantallas/catalogo.dart';
import 'pantallas/pedidos.dart';

void main() => runApp(const AppRemata());

class AppRemata extends StatefulWidget {
  const AppRemata({super.key});

  @override
  State<AppRemata> createState() => _AppRemataState();
}

class _AppRemataState extends State<AppRemata> {
  late final Repositorio _repo = Repositorio(ApiCliente());
  bool _autenticado = false;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'REMATA',
      debugShowCheckedModeBanner: false,
      theme: construirTema(),
      home: _autenticado
          ? _Navegacion(
              repo: _repo,
              alSalir: () {
                _repo.cerrarSesion();
                setState(() => _autenticado = false);
              },
            )
          : PantallaAuth(
              repo: _repo,
              alEntrar: () => setState(() => _autenticado = true),
            ),
    );
  }
}

/// Barra inferior. De las cinco pestañas del mockup (Inicio, Buscar, Favoritos,
/// Mis pedidos, Cuenta) están las que el backend puede sostener hoy: favoritos
/// no tiene API todavía, y ponerla sin funcionar sería peor que omitirla.
class _Navegacion extends StatefulWidget {
  const _Navegacion({required this.repo, required this.alSalir});

  final Repositorio repo;
  final VoidCallback alSalir;

  @override
  State<_Navegacion> createState() => _NavegacionState();
}

class _NavegacionState extends State<_Navegacion> {
  int _indice = 0;

  @override
  Widget build(BuildContext context) {
    final paginas = [
      PantallaCatalogo(repo: widget.repo),
      PantallaPedidos(repo: widget.repo),
      _PantallaCuenta(alSalir: widget.alSalir),
    ];

    return Scaffold(
      body: paginas[_indice],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _indice,
        onDestinationSelected: (i) => setState(() => _indice = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.search_outlined),
            selectedIcon: Icon(Icons.search),
            label: 'Buscar',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Mis pedidos',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Cuenta',
          ),
        ],
      ),
    );
  }
}

class _PantallaCuenta extends StatelessWidget {
  const _PantallaCuenta({required this.alSalir});

  final VoidCallback alSalir;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Mi cuenta')),
        body: ListView(
          padding: const EdgeInsets.all(RTokens.s4),
          children: [
            Container(
              padding: const EdgeInsets.all(RTokens.s4),
              decoration: BoxDecoration(
                color: RTokens.primarySoft,
                borderRadius: BorderRadius.circular(RTokens.radiusLg),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: RTokens.primary),
                  SizedBox(width: RTokens.s3),
                  Expanded(
                    child: Text(
                      'Perfil, direcciones, métodos de pago y REMATA Points '
                      'llegan en fases siguientes.',
                      style: RTokens.bodySm,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: RTokens.s5),
            OutlinedButton(
              onPressed: alSalir,
              style: OutlinedButton.styleFrom(foregroundColor: RTokens.danger),
              child: const Text('Cerrar sesión'),
            ),
          ],
        ),
      );
}
