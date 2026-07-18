import { useStudioStore } from '../_store/useStudioStore';

describe('transit studio stops', () => {
  beforeEach(() => {
    useStudioStore.getState().reset();
  });

  test('adds, names, and removes authored stops', () => {
    const store = useStudioStore.getState();
    store.addStop([36.2, 33.4]);

    const stop = useStudioStore.getState().stops[0];
    expect(stop?.coordinates).toEqual([36.2, 33.4]);

    if (!stop) {
      throw new Error('Expected an authored stop');
    }

    useStudioStore.getState().updateStopName(stop.id, 'البرامكة');
    expect(useStudioStore.getState().stops[0]?.nameAr).toBe('البرامكة');

    useStudioStore.getState().removeStop(stop.id);
    expect(useStudioStore.getState().stops).toEqual([]);
  });
});
