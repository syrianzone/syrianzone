Pod::Spec.new do |s|
  s.name = 'SyrianFiles'
  s.version = '0.1.0'
  s.summary = 'Native archive and image export for Syrian Zone'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Syrian Zone'
  s.homepage = 'https://github.com/syrianzone/syrianzone'
  s.platforms = { :ios => '18.0' }
  s.swift_version = '6.0'
  s.source = { :git => 'https://github.com/syrianzone/syrianzone.git' }
  s.static_framework = true
  s.frameworks = 'UIKit', 'ImageIO', 'QuickLook'
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
