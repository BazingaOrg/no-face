import { describe, expect, it } from 'vitest';
import { DetectedFace } from '@/types';
import { getBoxIoU, updateLiveFaceTracks } from './useLiveDetection';

const face = (x: number, id = 'detected'): DetectedFace => ({
  id,
  box: { x, y: 10, width: 20, height: 20 },
  detection: { score: 0.9, classScore: 0.9 },
});

describe('live face tracking', () => {
  it('calculates overlap and retains a matched track id with EMA smoothing', () => {
    expect(getBoxIoU(face(0).box, face(10).box)).toBeCloseTo(1 / 3);
    const first = updateLiveFaceTracks([], [face(0)], 0);
    const second = updateLiveFaceTracks(first.tracks, [face(10)], first.nextTrackId);

    expect(second.tracks[0].id).toBe('live-face-0');
    expect(second.tracks[0].box.x).toBeCloseTo(3.5);
  });

  it('removes a track after three consecutive missed detections', () => {
    let state = updateLiveFaceTracks([], [face(0)], 0);
    state = updateLiveFaceTracks(state.tracks, [], state.nextTrackId);
    state = updateLiveFaceTracks(state.tracks, [], state.nextTrackId);
    expect(state.tracks).toHaveLength(1);
    state = updateLiveFaceTracks(state.tracks, [], state.nextTrackId);
    expect(state.tracks).toHaveLength(0);
  });
});
