import 'package:freezed_annotation/freezed_annotation.dart';

part 'api_result.freezed.dart';

@freezed
class ApiResult<T> with _$ApiResult<T> {
  factory ApiResult.success(T data) = _Success;
  factory ApiResult.error(String error) = _Error;
}
