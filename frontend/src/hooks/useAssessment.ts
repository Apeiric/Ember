/**
 * EMBER — assessment state machine.
 * OWNER: FRONTEND
 *
 * Explicit states rather than a pile of booleans, so the UI can never render
 * "loading" and a stale verdict at the same time — which, on this product,
 * would mean showing someone an evacuation time that no longer applies.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssessResponse, UserProfile } from '@ember/shared';
import { assess, ApiRequestError } from '../lib/api';

export type AssessmentStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AssessmentState {
  status: AssessmentStatus;
  data: AssessResponse | null;
  error: { message: string; detail?: string } | null;
}

export interface RunOptions {
  address: string;
  profile: UserProfile;
  scenarioId?: string;
  forceOffline?: boolean;
  /** Situation reports gathered so far, oldest first. */
  reports?: string[];
  /** Skip the LLM prose pass — instant deterministic re-judgement. */
  fastVerdict?: boolean;
}

export function useAssessment() {
  const [state, setState] = useState<AssessmentState>({
    status: 'idle',
    data: null,
    error: null,
  });

  const inflight = useRef<AbortController | null>(null);
  const lastRequest = useRef<RunOptions | null>(null);

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => () => inflight.current?.abort(), []);

  const run = useCallback(async (options: RunOptions) => {
    // Toggling the profile mid-flight is the demo's kicker — cancel the previous
    // request so a slow first response cannot overwrite the newer one.
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    lastRequest.current = options;

    setState((prev) => ({ status: 'loading', data: prev.data, error: null }));

    try {
      const data = await assess(
        {
          address: options.address,
          profile: options.profile,
          scenarioId: options.scenarioId,
          forceOffline: options.forceOffline,
          reports: options.reports,
          fastVerdict: options.fastVerdict,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setState({ status: 'ready', data, error: null });
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return;
      }
      setState({
        status: 'error',
        data: null,
        error:
          err instanceof ApiRequestError
            ? { message: err.message, detail: err.detail }
            : { message: 'Something went wrong', detail: String(err) },
      });
    }
  }, []);

  /** Re-run with the same address but a different person. Powers the demo kicker. */
  const reprofile = useCallback(
    (profile: UserProfile) => {
      const last = lastRequest.current;
      if (!last) return;
      void run({ ...last, profile });
    },
    [run],
  );

  /**
   * Append a situation report and re-run.
   *
   * Reports ACCUMULATE — a road reported blocked stays blocked when the next
   * one arrives. Replacing the list instead of appending would silently reopen
   * a closed road the moment a second message came in.
   */
  const addReport = useCallback(
    (text: string) => {
      const last = lastRequest.current;
      if (!last) return;
      // A blocked-road report must re-judge INSTANTLY. The routes are already
      // computed — skip the prose pass and show the deterministic answer now.
      void run({ ...last, reports: [...(last.reports ?? []), text], fastVerdict: true });
    },
    [run],
  );

  const reset = useCallback(() => {
    inflight.current?.abort();
    lastRequest.current = null;
    setState({ status: 'idle', data: null, error: null });
  }, []);

  return { ...state, run, reprofile, addReport, reset };
}
