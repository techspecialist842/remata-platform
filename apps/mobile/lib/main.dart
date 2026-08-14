import 'package:flutter/material.dart';
import 'datos/api.dart';
import 'datos/repositorio.dart';
import 'design/tema.dart';
import 'design/tokens.dart';
import 'pantallas/auth.dart';
import 'pantallas/catalogo.dart';
import 'pantallas/cuenta_comercio.dart';
import 'pantallas/ordenes_recibidas.dart';
import 'pantallas/pedidos.dart';
import 'pantallas/publicaciones.dart';

void main() => runApp(const AppRemata());

class AppRemata extends StatefulWidget {
  const AppRemata({super.key});

  @override
  State<AppRemata> createState() => _AppRemataState();
}

class _AppRemataState extends State<AppRemata> {
  late final Repositorio _repo = Repositorio(ApiCliente());
  bool _autenticado = false;

  void _salir() {
    _repo.cerrarSesion();
    setState(() => _autenticado = false);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'REMATA',
      debugShowCheckedModeBanner: false,
      theme: construirTema(),
      home: !_autenticado
          ? PantallaAuth(
              repo: _repo,
              alEntrar: () => setState(() => _autenticado = true),
            )
          // Comprador y comercio son dos aplicaciones distintas dentro del
          // mismo binario: no comparten ni pestañas ni tareas.
          : _repo.esComercio
              ? _NavegacionComercio(repo: _repo, alSalir: _salir)
              : _Navegacion(repo: _repo, alSalir: _salir),
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

/// Panel del comercio. Dos tareas, que son las que sostiene el backend hoy:
/// gestionar lo que ofrece y atender lo que le piden.
class _NavegacionComercio extends StatefulWidget {
  const _NavegacionComercio({required this.repo, required this.alSalir});

  final Repositorio repo;
  final VoidCallback alSalir;

  @override
  State<_NavegacionComercio> createState() => _NavegacionComercioState();
}

class _NavegacionComercioState extends State<_NavegacionComercio> {
  int _indice = 0;

  @override
  Widget build(BuildContext context) {
    final paginas = [
      PantallaPublicaciones(repo: widget.repo),
      PantallaOrdenesRecibidas(repo: widget.repo),
      PantallaCuentaComercio(repo: widget.repo, alSalir: widget.alSalir),
    ];

    return Scaffold(
      body: paginas[_indice],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _indice,
        onDestinationSelected: (i) => setState(() => _indice = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Publicaciones',
          ),
          NavigationDestination(
            icon: Icon(Icons.inbox_outlined),
            selectedIcon: Icon(Icons.inbox),
            label: 'Órdenes',
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
