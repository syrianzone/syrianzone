import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

class DioFactory {
  late Dio _dio;
  DioFactory() {
    Duration timeOut = const Duration(seconds: 30);
    _dio = Dio();
    _dio
      ..options.connectTimeout = Duration(seconds: 10)
      ..options.receiveTimeout = timeOut;
    _dio.options.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    _dio.interceptors.add(
      PrettyDioLogger(
        requestBody: true,
        requestHeader: true,
        responseHeader: true,
      ),
    );
  }

  Dio get dio => _dio;
}
