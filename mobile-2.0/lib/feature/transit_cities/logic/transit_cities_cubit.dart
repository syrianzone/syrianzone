import 'package:bloc/bloc.dart';
import 'package:syrianzone/core/network/api_result.dart';
import 'package:syrianzone/core/network/response/city_response.dart';
import 'package:syrianzone/core/bloc/safe_emit_mixin.dart';
import 'package:syrianzone/feature/transit_cities/repo/transit_cities_repo.dart';
import 'transit_cities_state.dart';

class TransitCitiesCubit extends Cubit<TransitCitiesState>
    with SafeEmit<TransitCitiesState> {
  final TransitCitiesRepo _transitCitiesRepo;
  List<CityResponse> _allCities = const [];

  TransitCitiesCubit(this._transitCitiesRepo)
    : super(const TransitCitiesState.initial());

  /// Cities from the last successful response, unfiltered by [searchCities].
  /// Used for the header totals so they don't change while searching.
  List<CityResponse> get allCities => _allCities;

  Future<void> loadCities() async {
    safeEmit(const TransitCitiesState.loading());
    // Fetch cities from the repository
    final result = await _transitCitiesRepo.fetchTransitCities();
    result.whenOrNull(
      success: (cities) {
        _allCities = cities;
        safeEmit(TransitCitiesState.success(cities));
      },
      error: (message) => safeEmit(TransitCitiesState.error(message)),
    );
  }

  void searchCities(String query) {
    final normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.isEmpty) {
      safeEmit(TransitCitiesState.success(_allCities));
      return;
    }

    final filtered = _allCities.where((city) {
      final nameAr = city.nameAr.toLowerCase();
      final nameEn = city.nameEn.toLowerCase();
      return nameAr.contains(normalizedQuery) ||
          nameEn.contains(normalizedQuery);
    }).toList();

    safeEmit(TransitCitiesState.success(filtered));
  }
}
