import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/network/response/map_data_response.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/feature/transit/logic/transit_cubit.dart';
import 'package:syrianzone/feature/transit/logic/transit_state.dart';
import 'package:syrianzone/feature/transit/ui/widget/transit_app_bar_title.dart';
import 'package:syrianzone/feature/transit/ui/widget/route_card.dart';
import 'package:syrianzone/feature/transit/ui/widget/transit_map_pane.dart';
import 'package:syrianzone/feature/transit/ui/widget/transit_loading_list.dart';
import 'package:syrianzone/feature/transit/ui/widget/route_stops_details.dart';
import 'package:syrianzone/feature/transit/ui/widget/transit_search_bar.dart';

class TransitScreen extends StatefulWidget {
  final String cityId;
  final String cityName;
  final double? latitude;
  final double? longitude;
  final double? zoom;

  const TransitScreen({
    super.key,
    required this.cityId,
    required this.cityName,
    this.latitude,
    this.longitude,
    this.zoom,
  });

  static const cardBackground = Color(0xFFFCFCFC);
  static const cardBorder = Color(0xFFE4D8C8);
  static const titleColor = Color(0xFF2F2722);
  static const metaColor = Color(0xFF8D7E6E);
  static const priceBg = Color(0xFFF3ECE3);
  static const priceText = Color(0xFFAF6F17);

  @override
  State<TransitScreen> createState() => _TransitScreenState();
}

class _TransitScreenState extends State<TransitScreen> {
  String? _selectedRouteId;

  void _openRouteDetails(String routeId) {
    setState(() {
      _selectedRouteId = routeId;
    });
  }

  void _closeRouteDetails() {
    setState(() {
      _selectedRouteId = null;
    });
  }

  MapRouteFeature? _findSelectedRoute(List<MapRouteFeature> routes) {
    final routeId = _selectedRouteId;
    if (routeId == null) {
      return null;
    }
    for (final route in routes) {
      if (route.properties.id == routeId) {
        return route;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope<void>(
      canPop: _selectedRouteId == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _selectedRouteId != null) {
          _closeRouteDetails();
        }
      },
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        appBar: AppBar(
        centerTitle: true,
        title: BlocBuilder<TransitCubit, TransitState>(
          builder: (context, state) {
            final mapData = state.mapData;
            final subtitle = mapData != null
                ? '${TextUtil.toArabicDigits(mapData.routes.features.length)} خط سيرفيس'
                : '';
            return TransitAppBarTitle(
              title: widget.cityName,
              subtitle: subtitle,
            );
          },
        ),
      ),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                Expanded(
                  flex: 1,
                  child: BlocBuilder<TransitCubit, TransitState>(
                    builder: (context, state) {
                      return TransitMapPane(
                        latitude: widget.latitude,
                        longitude: widget.longitude,
                        zoom: widget.zoom,
                        selectedRouteId: _selectedRouteId,
                        mapData: state.mapData,
                      );
                    },
                  ),
                ),
                Expanded(
                  flex: 1,
                  child: BlocBuilder<TransitCubit, TransitState>(
                    builder: (context, state) {
                      if (state.isLoading) {
                        return const TransitLoadingList();
                      }

                      if (state.routesErrorMessage != null) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  state.routesErrorMessage!,
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 12),
                                FilledButton(
                                  onPressed: widget.cityId.isEmpty
                                      ? null
                                      : () => context
                                            .read<TransitCubit>()
                                            .fetchMapData(widget.cityId),
                                  child: const Text('إعادة المحاولة'),
                                ),
                              ],
                            ),
                          ),
                        );
                      }

                      final mapData = state.mapData;
                      if (mapData != null) {
                        final routes = mapData.routes.features;
                        final selectedRoute = _findSelectedRoute(routes);
                        final stopsByRouteId = <String, int>{};
                        for (final stopFeature in mapData.stops.features) {
                          for (final routeId in stopFeature.properties.routeIds) {
                            stopsByRouteId[routeId] =
                                (stopsByRouteId[routeId] ?? 0) + 1;
                          }
                        }

                        if (routes.isEmpty) {
                          return const Center(
                            child: Text('لا توجد خطوط متاحة حالياً'),
                          );
                        }

                        if (_selectedRouteId != null && selectedRoute == null) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted) {
                              _closeRouteDetails();
                            }
                          });
                        }

                        if (selectedRoute != null) {
                          final selectedStops = mapData.stops.features
                              .where(
                                (stop) => stop.properties.routeIds.contains(
                                  selectedRoute.properties.id,
                                ),
                              )
                              .toList();
                          return RouteStopsDetails(
                            route: selectedRoute.properties,
                            stops: selectedStops,
                            onBack: _closeRouteDetails,
                          );
                        }

                        return ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                          itemCount: routes.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 14),
                          itemBuilder: (context, index) {
                            final routeFeature = routes[index];
                            final routeId = routeFeature.properties.id;
                            return RouteCard(
                              route: routeFeature.properties,
                              stopsCount: stopsByRouteId[routeId] ?? 0,
                              onTap: () => _openRouteDetails(routeId),
                            );
                          },
                        );
                      }

                      return const SizedBox.shrink();
                    },
                  ),
                ),
              ],
            ),
            Positioned(
              top: 10,
              left: 16,
              right: 16,
              child: TransitSearchBar(
                cityId: widget.cityId,
                selectedRouteId: _selectedRouteId,
                onRouteSelected: _openRouteDetails,
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }
}
