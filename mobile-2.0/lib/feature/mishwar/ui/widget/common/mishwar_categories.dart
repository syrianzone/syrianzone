import 'package:syrianzone/feature/mishwar/constants/mishwar_constants.dart';


const List<Map<String, String?>> kMishwarFilterCategories = MishwarConstants.filterCategories;

const List<Map<String, String>> kMishwarPlaceCategories = MishwarConstants.placeCategories;

String getMishwarCategoryLabel(String? categoryKey) => MishwarConstants.getCategoryLabel(categoryKey);
