import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/core/extensions/locale_extensions.dart';
import 'package:syrianzone/core/extensions/navigation_extensions.dart';
import 'package:syrianzone/core/routing/routes.dart';
import 'package:syrianzone/core/util/text_util.dart';
import 'package:syrianzone/core/widget/api_svg_icon.dart';
import 'package:syrianzone/feature/transit/data/transit_args.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_cubit.dart';
import 'package:syrianzone/feature/transit_cities/logic/transit_cities_state.dart';

class TransitCitiesGridBloc extends StatelessWidget {
  const TransitCitiesGridBloc({super.key});

  static const _cardBackground = Color(0xFFFCFCFC);
  static const _cardBorder = Color(0xFFE4D8C8);
  static const _iconBadgeBackground = Color(0xFFF1EDE6);
  static const _titleColor = Color(0xFF2F2722);
  static const _subtitleColor = Color(0xFF85786E);
  static const _iconColor = Color(0xFFAB6D17);
  static const _disabledCardBackground = Color(0xFFF9F9F8);
  static const _disabledCardBorder = Color(0xFFE8E4DC);
  static const _disabledIconBadgeBackground = Color(0xFFF4F1EB);
  static const _disabledTitleColor = Color(0xFF908B84);
  static const _disabledSubtitleColor = Color(0xFFB7AEA2);
  static const _disabledIconColor = Color(0xFFC4A880);

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TransitCitiesCubit, TransitCitiesState>(
      builder: (context, state) {
        return state.maybeWhen(
          loading: () => const _TransitCitiesShimmerGrid(),
          success: (cities) => Column(
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(0, 4, 0, 12),
                child: _TransitCitiesSearchField(),
              ),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: cities.length,
                itemBuilder: (context, index) {
                  final city = cities[index];

                  final isActive = city.routeCount > 0;
                  final cardBackground = isActive
                      ? _cardBackground
                      : _disabledCardBackground;
                  final cardBorder = isActive
                      ? _cardBorder
                      : _disabledCardBorder;
                  final iconBadgeBackground = isActive
                      ? _iconBadgeBackground
                      : _disabledIconBadgeBackground;
                  final iconColor = isActive ? _iconColor : _disabledIconColor;
                  final titleColor = isActive
                      ? _titleColor
                      : _disabledTitleColor;
                  final subtitleColor = isActive
                      ? _subtitleColor
                      : _disabledSubtitleColor;

                  return Opacity(
                    opacity: isActive ? 1 : 0.9,
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(24),
                        onTap: () {
                          if (!isActive) return;
                          context.pushNamed(
                            Routes.transit,
                            arguments: TransitArgs(
                              city.id,
                              city.nameAr,
                              // `center` is a GeoJSON Point: [lng, lat].
                              latitude: city.center[1],
                              longitude: city.center[0],
                              zoom: city.zoom,
                            ),
                          );
                        },
                        child: Ink(
                          decoration: BoxDecoration(
                            color: cardBackground,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: cardBorder),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 14,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 82,
                                height: 82,
                                decoration: BoxDecoration(
                                  color: iconBadgeBackground,
                                  borderRadius: BorderRadius.circular(24),
                                ),
                                alignment: Alignment.center,
                                child: ApiSvgIcon(
                                  viewBox: city.icon.viewBox,
                                  path: city.icon.path,
                                  color: iconColor,
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                city.nameAr,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: titleColor,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  height: 1.15,
                                ),
                              ),
                              const SizedBox(height: 4),
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: isActive
                                    ?  Text(
                                            context.appLocalizations.routes(
                                              city.routeCount,
                                              TextUtil.toArabicDigits(city.routeCount),
                                            ),
                                            style: TextStyle(
                                              color: subtitleColor,
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          )
                                    : Text(
                                        'قريباً',
                                        style: TextStyle(
                                          color: subtitleColor,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
          error: (message) => Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                vertical: 40.0,
                horizontal: 20.0,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    size: 48,
                    color: Theme.of(context).colorScheme.error,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: _titleColor,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () =>
                        context.read<TransitCitiesCubit>().loadCities(),
                    icon: const Icon(Icons.refresh_rounded, size: 20),
                    label: const Text('إعادة المحاولة'),
                  ),
                ],
              ),
            ),
          ),
          orElse: () => const SizedBox.shrink(),
        );
      },
    );
  }
}

class _TransitCitiesSearchField extends StatefulWidget {
  const _TransitCitiesSearchField();

  @override
  State<_TransitCitiesSearchField> createState() =>
      _TransitCitiesSearchFieldState();
}

class _TransitCitiesSearchFieldState extends State<_TransitCitiesSearchField> {
  final TextEditingController _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _clearSearch() {
    _controller.clear();
    context.read<TransitCitiesCubit>().searchCities('');
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: context.read<TransitCitiesCubit>().searchCities,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: 'ابحث عن مدينة',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                onPressed: _clearSearch,
                icon: const Icon(Icons.clear),
              ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }
}

class _TransitCitiesShimmerGrid extends StatelessWidget {
  const _TransitCitiesShimmerGrid();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.82,
      ),
      itemCount: 8,
      itemBuilder: (context, index) {
        return Container(
          decoration: BoxDecoration(
            color: TransitCitiesGridBloc._cardBackground,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: TransitCitiesGridBloc._cardBorder),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          child: Shimmer.fromColors(
            baseColor: const Color(0xFFF1ECE3),
            highlightColor: const Color(0xFFF8F5EF),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 82,
                  height: 82,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  height: 16,
                  width: 90,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  height: 12,
                  width: 54,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
