import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syrianzone/feature/auth/logic/auth_cubit.dart';
import 'package:syrianzone/feature/auth/logic/auth_state.dart';
import 'package:syrianzone/feature/auth/ui/auth_bottom_sheet.dart';

class AppBarAuthButton extends StatelessWidget {
  const AppBarAuthButton({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        return state.when(
          initial: () => _buildGoogleButton(context),
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: SizedBox(
              width: 20,
              height: 20,
              child: Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
          authenticated: (user) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => UserAccountBottomSheet.show(context, user),
              child: Padding(
                padding: const EdgeInsets.all(4.0),
                child: CircleAvatar(
                  radius: 16,
                  backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                  backgroundImage: user.avatarUrl != null
                      ? CachedNetworkImageProvider(user.avatarUrl!)
                      : null,
                  child: user.avatarUrl == null
                      ? Text(
                          (user.name?.isNotEmpty ?? false)
                              ? user.name![0].toUpperCase()
                              : 'U',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        )
                      : null,
                ),
              ),
            ),
          ),
          unauthenticated: (_) => _buildGoogleButton(context),
          error: (_) => _buildGoogleButton(context),
        );
      },
    );
  }

  Widget _buildGoogleButton(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Tooltip(
        message: 'تسجيل الدخول باستخدام Google',
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => AuthBottomSheet.show(context),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.withAlpha(120)),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildGoogleIcon(),
                const SizedBox(width: 6),
                const Text(
                  'دخول',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGoogleIcon() {
    return Container(
      width: 20,
      height: 20,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
      ),
      child: const Center(
        child: Text(
          'G',
          style: TextStyle(
            color: Color(0xFF4285F4),
            fontWeight: FontWeight.bold,
            fontSize: 14,
            height: 1.1,
          ),
        ),
      ),
    );
  }
}
