Pod::Spec.new do |s|
  s.name = 'SyrianAudio'
  s.version = '0.1.0'
  s.summary = 'Shared native Quran playback, remote Ayah commands and sleep deadline.'
  s.homepage = 'https://github.com/syrianzone/syrianzone'
  s.license = { :type => 'MIT' }
  s.author = 'Syrian Zone'
  s.platforms = { :ios => '18.0' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'MediaPlayer', 'UIKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '*.swift'
  s.test_spec 'Tests' do |test|
    test.source_files = '../Tests/*.swift'
  end
end
