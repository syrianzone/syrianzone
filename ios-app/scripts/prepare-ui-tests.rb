require 'xcodeproj'

root = File.expand_path('..', __dir__)
path = File.join(root, 'ios', 'SyrianZone.xcodeproj')
project = Xcodeproj::Project.open(path)
app = project.targets.find { |target| target.name == 'SyrianZone' }
raise 'Native app target is missing. Run Expo prebuild first.' unless app

name = 'SyrianZoneUITests'
target = project.targets.find { |candidate| candidate.name == name } || project.new_target(:ui_test_bundle, name, :ios, '18.0')
target.add_dependency(app) unless target.dependencies.any? { |dependency| dependency.target == app }
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'zone.syrian.ios.uitests',
    'PRODUCT_NAME' => name,
    'PRODUCT_MODULE_NAME' => name,
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'INFOPLIST_KEY_NSPhotoLibraryUsageDescription' => 'Simulator UI tests read only their explicitly recorded generated QA photo and album.',
    'INFOPLIST_KEY_NSPhotoLibraryAddUsageDescription' => 'Simulator UI tests create one generated QA photo in their uniquely named test album.',
    'TEST_TARGET_NAME' => app.name,
    'SWIFT_VERSION' => '5.10',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'IPHONEOS_DEPLOYMENT_TARGET' => '18.0',
    'TARGETED_DEVICE_FAMILY' => '1,2'
  })
end
Dir.glob(File.join(root, 'native-tests', '*.swift')).sort.each do |source|
  source_path = '../native-tests/' + File.basename(source)
  reference = project.files.find { |file| file.path == source_path } || project.main_group.new_file(source_path)
  target.source_build_phase.add_file_reference(reference) unless target.source_build_phase.files_references.include?(reference)
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.test_action.build_configuration = 'Release'
scheme.launch_action.build_configuration = 'Release'
scheme.launch_action.buildable_product_runnable = Xcodeproj::XCScheme::BuildableProductRunnable.new(app)
scheme.save_as(path, 'SyrianZoneVerification', true)
puts 'Prepared native iPhone UI test scheme.'
