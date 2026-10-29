import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/core/extensions/color_scheme_extensions.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/core/widget/bump_animation.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_cubit.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_state.dart';
import 'package:syrianzone/feature/transit_cities/ui/transit_cities_grid_bloc.dart';

class TransitCitiesScreen extends StatelessWidget {
  const TransitCitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(centerTitle: true, title: BumpyBusAnimation()),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                color: context.colorScheme.primary,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 16, 8, 16),
                  child: Column(
                    children: [
                      Text(
                        "ترانزيت سوريا",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        "دليل وخرائط تفاعلية لشبكات وخطوط المواصلات العامة والسرافيس في المدن السورية — يجمعها المجتمع ويحدّثها، ومتاحة للجميع مجاناً.",
                        style: TextStyle(color: Colors.white, fontSize: 16),
                        textAlign: TextAlign.right,
                      ),

                      const SizedBox(height: 16),

                      const _TransitCitiesStats(),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(8.0),
                child: TransitCitiesGridBloc(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}


class _TransitCitiesStats extends StatelessWidget {
  const _TransitCitiesStats();

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<TransitCitiesCubit>();

    return BlocBuilder<TransitCitiesCubit, TransitCitiesState>(
      builder: (context, state) {
        return state.maybeWhen(
          success: (_) {
            final cities = cubit.allCities
                .where((city) => city.routeCount > 0)
                .toList();
            final routeCount = cities.fold<int>(
              0,
              (total, city) => total + city.routeCount,
            );

            return Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _TransitCitiesStatItem(
                  label: 'مدن جاهزة',
                  value: TextUtil.toArabicDigits(cities.length),
                ),
                const VerticalDivider(),
                _TransitCitiesStatItem(
                  label: 'خط سيرفيس',
                  value: TextUtil.toArabicDigits(routeCount),
                ),
              ],
            );
          },
          orElse: () => const SizedBox.shrink(),
        );
      },
    );
  }
}

class _TransitCitiesStatItem extends StatelessWidget {
  const _TransitCitiesStatItem({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      spacing: 4,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 14)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 16)),
      ],
    );
  }
}
