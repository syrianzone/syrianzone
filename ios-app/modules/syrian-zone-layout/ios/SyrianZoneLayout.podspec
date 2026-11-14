Pod::Spec.new do |s|
  s.name = 'SyrianZoneLayout'
  s.version = '0.1.0'
  s.summary = 'Native window and hinge geometry for Syrian Zone.'
  s.homepage = 'https://github.com/syrianzone/syrianzone'
  s.license = { :type => 'MIT', :file => '../LICENSE' }
  s.author = 'Syrian Zone'
  s.platforms = { :ios => '18.0' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
