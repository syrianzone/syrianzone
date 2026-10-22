import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:syrianzone/core/network/response/api_error_response.dart';

class ApiErrorHandler {
  static String handleError(dynamic error) {
    if (error is DioException) {
      return _handleDioError(error);
    }

    if (error is SocketException) {
      return 'لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة والمحاولة مجدداً';
    }

    if (error is FormatException) {
      return 'حدث خطأ في معالجة البيانات المستلمة';
    }

    if (error is String) {
      final lower = error.toLowerCase();
      if (lower.contains('socketexception') ||
          lower.contains('network is unreachable') ||
          lower.contains('failed host lookup') ||
          lower.contains('no internet')) {
        return 'لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة والمحاولة مجدداً';
      }
      if (lower.contains('timeoutexception') || lower.contains('timed out')) {
        return 'انتهت مهلة الاتصال بالخادم، يرجى المحاولة مرة أخرى';
      }
      if (lower.contains('dioexception') || lower.contains('exception:')) {
        return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى';
      }
      return error;
    }

    return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى';
  }

  static String _handleDioError(DioException dioException) {
    // 1. If there is a response body returned, attempt to extract ApiErrorResponse.message
    final response = dioException.response;
    if (response?.data != null) {
      try {
        final data = response!.data;
        if (data is Map<String, dynamic>) {
          try {
            final apiError = ApiErrorResponse.fromJson(data);
            if (apiError.message.isNotEmpty) {
              return apiError.message;
            }
          } catch (_) {
            final msg = data['message'] ?? data['error'] ?? data['msg'];
            if (msg is String && msg.isNotEmpty) {
              return msg;
            }
          }
        } else if (data is String && data.isNotEmpty) {
          try {
            final decoded = jsonDecode(data);
            if (decoded is Map<String, dynamic>) {
              final apiError = ApiErrorResponse.fromJson(decoded);
              if (apiError.message.isNotEmpty) {
                return apiError.message;
              }
            }
          } catch (_) {}

         
        }
      } catch (_) {}

    }

    // 2. Check for socket / network connectivity issue
    if (dioException.type == DioExceptionType.connectionError ||
        dioException.error is SocketException) {
      return 'لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة والمحاولة مجدداً';
    }

    // 3. Handle by DioExceptionType
    switch (dioException.type) {
      case DioExceptionType.connectionTimeout:
        return 'انتهت مهلة الاتصال بالخادم، يرجى المحاولة مرة أخرى';
      case DioExceptionType.sendTimeout:
        return 'انتهت مهلة إرسال البيانات، يرجى المحاولة مرة أخرى';
      case DioExceptionType.receiveTimeout:
        return 'انتهت مهلة استلام البيانات من الخادم، يرجى المحاولة مرة أخرى';
      case DioExceptionType.badCertificate:
        return 'فشل التحقق من أمان الاتصال بالخادم';
      case DioExceptionType.cancel:
        return 'تم إلغاء الطلب';
      case DioExceptionType.badResponse:
        return _handleStatusCode(response?.statusCode);
      case DioExceptionType.connectionError:
        return 'لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة والمحاولة مجدداً';
      case DioExceptionType.unknown:
        final message = dioException.message?.toLowerCase() ?? '';
        final errorStr = dioException.error?.toString().toLowerCase() ?? '';
        if (message.contains('socket') ||
            message.contains('lookup') ||
            message.contains('network') ||
            errorStr.contains('socket') ||
            errorStr.contains('network')) {
          return 'لا يوجد اتصال بالإنترنت، يرجى التحقق من الشبكة والمحاولة مجدداً';
        }
      default:
        return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى';
    }
    return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى';
  }

  static String _handleStatusCode(int? statusCode) {
    switch (statusCode) {
      case 400:
        return 'طلب غير صالح، يرجى التحقق من البيانات والمحاولة مجدداً';
      case 401:
        return 'جلسة العمل غير مصرح بها أو منتهية، يرجى تسجيل الدخول مجدداً';
      case 403:
        return 'ليس لديك الصلاحية للوصول إلى هذا المحتوى';
      case 404:
        return 'البيانات المطلوبة غير موجودة';
      case 408:
        return 'انتهت مهلة الطلب، يرجى المحاولة مرة أخرى';
      case 409:
        return 'حدث تعارض أثناء معالجة الطلب، يرجى المحاولة لاحقاً';
      case 422:
        return 'بيانات غير صالحة، يرجى التأكد من صحة المدخلات';
      case 429:
        return 'تم تجاوز الحد المسموح به من الطلبات، يرجى الانتظار قليلاً';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'حدث خطأ في الخادم، يرجى المحاولة في وقت لاحق';
      default:
        return 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة مرة أخرى';
    }
  }
}
