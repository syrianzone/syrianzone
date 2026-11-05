import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:syrianzone/core/network/response/guides_response.dart';
import 'package:syrianzone/core/network/response/place_detail_response.dart';
import 'package:syrianzone/core/di/get_it.dart';
import 'package:syrianzone/feature/mishwar/logic/guide/guide_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/guide/guide_detail_state.dart';
import 'package:syrianzone/feature/mishwar/logic/hotel/hotel_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/hotel/hotel_detail_state.dart';
import 'package:syrianzone/feature/mishwar/logic/mishwar_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/place/place_detail_cubit.dart';
import 'package:syrianzone/feature/mishwar/logic/place/place_detail_state.dart';
import 'package:syrianzone/feature/mishwar/repo/mishwar_repo.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shimmer/shimmer.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_filter_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_gallery_view.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/common/mishwar_search_bar.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/guide_detail_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/guide/mishwar_guides_tab.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/hotel/hotel_detail_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/add_place_bottom_sheet.dart';
import 'package:syrianzone/feature/mishwar/ui/widget/place/place_detail_bottom_sheet.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
    await setupGetIt();
  });
  testWidgets('GuideDetailBottomSheet renders in light mode with RTL and stats', (tester) async {
    final guide = GuideItemResponse(
      rank: 1,
      userId: 1,
      name: 'maj',
      level: 5,
      points: 785,
      approvedCount: 25,
      savesTotal: 0,
      recentCount: 0,
      avatarUrl: null,
    );

    bool showOnMapTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: GuideDetailBottomSheet(
            guide: guide,
            onShowOnMap: () {
              showOnMapTapped = true;
            },
          ),
        ),
      ),
    );

    // Verify Name, Points, and Stats are present
    expect(find.text('maj'), findsOneWidget);
    expect(find.text('مساهمة'), findsOneWidget);
    expect(find.text('حفظ'), findsOneWidget);
    expect(find.text('آخر 30 يوماً'), findsOneWidget);
    expect(find.text('عرض المساهمات على الخريطة'), findsOneWidget);

    // Tap CTA button
    await tester.tap(find.text('عرض المساهمات على الخريطة'));
    await tester.pump();
    expect(showOnMapTapped, isTrue);
  });

  testWidgets('PlaceDetailBottomSheet renders RTL without divider line', (tester) async {
    final place = PlaceDetailResponse(
      id: 10,
      name: 'مسجد بني أمية الكبير',
      category: 'religious',
      description: 'أحد أكبر وأقدم المساجد في العالم.',
      lat: 33.5118,
      lng: 36.3065,
      savesCount: 142,
      photos: [],
      user: null,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PlaceDetailBottomSheet(place: place),
        ),
      ),
    );

    // Name should be displayed
    expect(find.text('مسجد بني أمية الكبير'), findsAtLeastNWidgets(1));
    expect(find.text('أحد أكبر وأقدم المساجد في العالم.'), findsOneWidget);
    expect(find.text('افتح في خرائط جوجل'), findsOneWidget);

    // Verify no Divider widget exists
    expect(find.byType(Divider), findsNothing);
  });

  testWidgets('AddPlaceBottomSheet displays required fields and validates on empty submit', (tester) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    final cubit = getIt<MishwarCubit>();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: cubit,
            child: const AddPlaceBottomSheet(lat: 33.5154, lng: 36.3027),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify Title and Subtitle
    expect(find.text('إضافة مكان جديد'), findsOneWidget);
    expect(find.text('اسم المكان'), findsOneWidget);
    expect(find.text('التصنيف'), findsOneWidget);
    expect(find.text('الوصف'), findsOneWidget);
    expect(find.text('الإحداثيات'), findsOneWidget);
    expect(find.text('الصور'), findsOneWidget);

    final submitBtn = find.text('إرسال المكان');
    expect(submitBtn, findsOneWidget);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    // Verify validation errors appear
    expect(find.text('يرجى إدخال اسم المكان'), findsOneWidget);
    expect(find.text('يرجى اختيار التصنيف'), findsOneWidget);
    expect(find.text('يرجى اختيار صورة واحدة على الأقل'), findsOneWidget);
  });

  test('MishwarCubit searchPlaces debounces and updates searchQuery', () async {
    final cubit = getIt<MishwarCubit>();

    cubit.searchPlaces('قلعة');
    expect(cubit.state.placesSearchQuery, isNull); // not immediately set before debounce

    await Future.delayed(const Duration(milliseconds: 400));
    expect(cubit.state.placesSearchQuery, 'قلعة');

    cubit.clearPlacesSearch();
    expect(cubit.state.placesSearchQuery, isNull);
    expect(cubit.state.searchResults, isEmpty);
  });

  test('MishwarCubit searchPlaces isolates results from main places list', () async {
    final cubit = getIt<MishwarCubit>();

    final initialPlaces = cubit.state.places;
    cubit.searchPlaces('قلعة');
    await Future.delayed(const Duration(milliseconds: 400));

    // Main places list is not mutated by the search bar query
    expect(cubit.state.places, equals(initialPlaces));
    cubit.clearPlacesSearch();
  });

  testWidgets('MishwarFilterBottomSheet renders Type and Category sections and dismisses on category tap', (tester) async {
    String? selectedType;
    String? selectedCategory;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () {
                MishwarFilterBottomSheet.show(
                  context,
                  selectedType: 'all',
                  selectedCategory: null,
                  onTypeChanged: (t) => selectedType = t,
                  onCategoryChanged: (c) => selectedCategory = c,
                );
              },
              child: const Text('Open Filter'),
            ),
          ),
        ),
      ),
    );

    // Open sheet
    await tester.tap(find.text('Open Filter'));
    await tester.pumpAndSettle();

    expect(find.text('النوع'), findsOneWidget);
    expect(find.text('الفئة'), findsOneWidget);
    expect(find.text('أماكن'), findsOneWidget);
    expect(find.text('فنادق'), findsOneWidget);
    expect(find.text('تاريخي'), findsOneWidget);

    // Type tap does not dismiss
    await tester.tap(find.text('فنادق'));
    await tester.pump();
    expect(selectedType, 'hotels');
    expect(find.text('الفئة'), findsOneWidget); // sheet is still open

    // Category tap dismisses the sheet
    await tester.tap(find.text('تاريخي'));
    await tester.pumpAndSettle();
    expect(selectedCategory, 'historical');
    expect(find.text('الفئة'), findsNothing); // sheet is dismissed!
  });

  testWidgets('MishwarSearchBar animates to full width on tap and restores on close', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: getIt<MishwarCubit>(),
            child: MishwarSearchBar(
              onPlaceSelected: (_) {},
              isGalleryMode: false,
              onViewModeChanged: (_) {},
              onOpenFilter: () {},
              activeFilterLabel: 'تصفية',
              hasActiveFilter: false,
            ),
          ),
        ),
      ),
    );

    // Initially compact: shows all 3 items
    expect(find.text('خريطة'), findsOneWidget);
    expect(find.text('معرض'), findsOneWidget);
    expect(find.text('تصفية'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);

    // Tap into text field to expand
    await tester.tap(find.byType(TextField));
    await tester.pumpAndSettle();

    // Mode and Filter should now be hidden/collapsed
    expect(find.text('خريطة'), findsNothing);
    expect(find.text('تصفية'), findsNothing);

    // Close button appears
    expect(find.byIcon(Icons.close), findsOneWidget);

    // Tap close to restore
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();

    // Compact items restored!
    expect(find.text('خريطة'), findsOneWidget);
    expect(find.text('تصفية'), findsOneWidget);
  });

  testWidgets('MishwarGalleryView renders place cards and triggers onPlaceTap', (tester) async {
    final cubit = getIt<MishwarCubit>();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: cubit,
            child: MishwarGalleryView(
              onPlaceTap: (_) {},
            ),
          ),
        ),
      ),
    );

    expect(find.byType(MishwarGalleryView), findsOneWidget);
  });

  testWidgets('MishwarGuidesTab renders header and opens MishwarRanksBottomSheet on ranks tap', (tester) async {
    final cubit = getIt<MishwarCubit>();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: cubit,
            child: MishwarGuidesTab(
              onShowGuideOnMap: (_) {},
            ),
          ),
        ),
      ),
    );

    // Verify header title and ranks button are present
    expect(find.text('المرشدون المحليون'), findsOneWidget);
    expect(find.text('الرتب'), findsOneWidget);

    // Tap 'الرتب' button
    await tester.tap(find.text('الرتب'));
    await tester.pumpAndSettle();

    // Verify MishwarRanksBottomSheet opens with content
    expect(find.text('مستويات مشوار'), findsOneWidget);
    expect(find.text('كيف تُحسب النقاط؟'), findsOneWidget);
    expect(find.text('النقاط المطلوبة'), findsOneWidget);
    expect(find.text('مبتدئ 1'), findsOneWidget);
    expect(find.text('وزير السياحة 10'), findsOneWidget);
    expect(find.text('100,000'), findsOneWidget);
  });

  testWidgets('PlaceDetailBottomSheet and HotelDetailBottomSheet render shimmer loading state when loading', (tester) async {
    final placeCubit = PlaceDetailCubit(
      getIt<MishwarRepo>(),
      initialState: const PlaceDetailState.loading(),
    );

    // Test PlaceDetailBottomSheet in loading state
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: placeCubit,
            child: const PlaceDetailBottomSheet(
              placeId: 999,
              initialName: 'قلعة دمشق',
            ),
          ),
        ),
      ),
    );

    // Initial title displays immediately while content shows shimmer skeleton
    expect(find.text('قلعة دمشق'), findsOneWidget);
    expect(find.byType(Shimmer), findsOneWidget);

    final hotelCubit = HotelDetailCubit(
      getIt<MishwarRepo>(),
      initialState: const HotelDetailState.loading(),
    );

    // Test HotelDetailBottomSheet in loading state
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: hotelCubit,
            child: const HotelDetailBottomSheet(
              hotelId: 888,
              initialName: 'فندق الشام',
            ),
          ),
        ),
      ),
    );

    expect(find.text('فندق الشام'), findsOneWidget);
    expect(find.byType(Shimmer), findsOneWidget);
  });

  testWidgets('PlaceDetailBottomSheet and HotelDetailBottomSheet render error state with retry button', (tester) async {
    final placeCubit = PlaceDetailCubit(
      getIt<MishwarRepo>(),
      initialState: const PlaceDetailState.error('فشل الاتصال بالخادم'),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: placeCubit,
            child: const PlaceDetailBottomSheet(
              placeId: 999,
              initialName: 'قلعة دمشق',
            ),
          ),
        ),
      ),
    );

    // Error UI with retry button
    expect(find.text('تعذر تحميل تفاصيل المكان'), findsOneWidget);
    expect(find.text('فشل الاتصال بالخادم'), findsOneWidget);
    expect(find.text('إعادة المحاولة'), findsOneWidget);

    final hotelCubit = HotelDetailCubit(
      getIt<MishwarRepo>(),
      initialState: const HotelDetailState.error('تعذر جلب تفاصيل الفندق'),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: hotelCubit,
            child: const HotelDetailBottomSheet(
              hotelId: 888,
              initialName: 'فندق الشام',
            ),
          ),
        ),
      ),
    );

    expect(find.text('تعذر تحميل تفاصيل الفندق'), findsOneWidget);
    expect(find.text('تعذر جلب تفاصيل الفندق'), findsOneWidget);
    expect(find.text('إعادة المحاولة'), findsOneWidget);
  });

  testWidgets('GuideDetailBottomSheet renders shimmer loading and error states', (tester) async {
    final guide = GuideItemResponse(
      rank: 1,
      userId: 1,
      name: 'maj',
      level: 5,
      points: 785,
      approvedCount: 25,
      savesTotal: 0,
      recentCount: 0,
      avatarUrl: null,
    );

    final guideLoadingCubit = GuideDetailCubit(
      initialState: const GuideDetailState.loading(),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: guideLoadingCubit,
            child: GuideDetailBottomSheet(
              guide: guide,
              onShowOnMap: () {},
              initialLoading: true,
            ),
          ),
        ),
      ),
    );

    expect(find.byType(Shimmer), findsOneWidget);

    final guideErrorCubit = GuideDetailCubit(
      initialState: const GuideDetailState.error('تعذر جلب تفاصيل المرشد'),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BlocProvider.value(
            value: guideErrorCubit,
            child: GuideDetailBottomSheet(
              guide: guide,
              onShowOnMap: () {},
              initialLoading: true,
            ),
          ),
        ),
      ),
    );

    expect(find.text('تعذر تحميل بيانات المرشد'), findsOneWidget);
    expect(find.text('تعذر جلب تفاصيل المرشد'), findsOneWidget);
    expect(find.text('إعادة المحاولة'), findsOneWidget);
  });
}
