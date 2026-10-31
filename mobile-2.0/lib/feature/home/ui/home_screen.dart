import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:syrianzone/core/extensions/navigation_extensions.dart';
import 'package:syrianzone/core/extensions/text_theme_extensions.dart';
import 'package:syrianzone/core/routing/routes.dart';
import 'package:syrianzone/feature/auth/ui/app_bar_auth_button.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: SvgPicture.asset(
          'assets/images/logo-lightmode.svg',
          width: 48,
          height: 48,
        ),
        actions: const [
          AppBarAuthButton(),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: GridView.builder(
            itemCount: 2,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 4.0,
              crossAxisSpacing: 4.0,
            ),
            itemBuilder: (context, index) {
              if(index == 0){
              return InkWell(
                onTap: () {
                  context.pushNamed(Routes.transitCities);
                },
                child: Card(
                  child: Center(
                    child: Column(
                      spacing: 4,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SvgPicture.asset('assets/images/ic_transit.svg',width: 48,height: 48),
                        Text("ترانزيت",style:context.textTheme.headlineSmall),
                      ],
                    ),
                  ),
                ),
              );
              }else {
                return Card(
                  color: Colors.grey.withAlpha(200),
                  child: Center(
                    child: Column(
                      spacing: 4,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.location_on,color: Colors.red,size: 48),
                        Text("مشوار",style:context.textTheme.headlineSmall),
                      ],
                    ),
                  ),
                );
              }
            },
          ),
        ),
      ),
    );
  }
}
