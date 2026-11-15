import { useCallback } from 'react';
import { ScrollView } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, Heading, Label, RequestStatus, Section } from '../../components';
import { NativeAction } from '../../ui/native';
import { useResource } from '../../resource';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { record } from '../../platform/validation';
import { AlignmentBars, AxisBars, CompassPlot, CompassStory } from './Graphics';
import { buildResult, decodeAnswers, decodeCompassPage, quizVersion } from './model';
import { PersonaIcon } from './PersonaIcon';

export function CompassSharedScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const navigation = useFeatureNavigation(); const shareId = params.shareId ?? '';
  const resource = useResource(useCallback(signal => {
    if (!/^[a-f0-9]{32}$/.test(shareId)) return Promise.reject(new Error('رابط النتيجة المشتركة غير صالح'));
    return api.page(`/compass/s/${shareId}`, 'Compass/Shared', value => { const page = record(value); const config = decodeCompassPage(page); const version = quizVersion(page.version); const result = buildResult(decodeAnswers(page.answers, version), version, config, `share:${shareId}`); return { result, spectrum: config.personas.find(persona => persona.id === result.spectrum) ?? null }; }, { signal });
  }, [shareId]));
  const data = resource.data;
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><Heading subtitle="نتيجة منشورة، لا تُضاف تلقائياً إلى حسابك أو الإحصاءات">نتيجة بوصلة مشتركة</Heading><RequestStatus resource={resource} />{data ? <><Section><PersonaIcon {...(data.spectrum ? { name: data.spectrum.icon } : {})} /><Heading subtitle={data.spectrum?.short ?? ''}>{data.spectrum?.name ?? 'نتيجة البوصلة'}</Heading><Label>{data.spectrum?.factoid}</Label>{data.spectrum?.stances.map(stance => <Label key={stance}>• {stance}</Label>)}<Label>درجة الاتساق: {Math.round(data.result.consistency * 100)}%، الإجابات: {data.result.answered}</Label></Section><Section><Heading>موقع النتيجة على المحاور</Heading><AxisBars scores={data.result.scores} /></Section><Section><Heading>التوجّه الخارجي</Heading><AlignmentBars result={data.result} /></Section><CompassPlot scores={data.result.scores} /><CompassStory result={data.result} spectrum={data.spectrum} /></> : null}<NativeAction title="خُض الاختبار بنفسك" onPress={() => navigation.open('compass')} /></ScrollView>} />;
}
// PORT STATUS: source resources/js/Pages/Compass/Shared.tsx; confidence medium; todos 0.
