import 'src/logger';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { VoiceRecorderService } from './voice-recorder.service';

// ---- Fakes -----------------------------------------------------------------------------------
// Never touch real hardware: navigator.mediaDevices.getUserMedia, MediaRecorder, and
// navigator.permissions.query are always stubbed, and every stub is restored afterwards.

class FakeMediaStreamTrack {
  readonly stop = vi.fn();
}

class FakeMediaStream {
  private readonly tracks: Array<FakeMediaStreamTrack>;

  constructor(trackCount = 2) {
    this.tracks = Array.from({ length: trackCount }, () => new FakeMediaStreamTrack());
  }

  getTracks(): Array<FakeMediaStreamTrack> {
    return this.tracks;
  }
}

class FakeMediaRecorder extends EventTarget {
  static instances: Array<FakeMediaRecorder> = [];

  readonly mimeType = 'audio/webm';
  readonly startSpy = vi.fn();
  state: 'inactive' | 'recording' = 'inactive';

  constructor(readonly stream: FakeMediaStream) {
    super();
    FakeMediaRecorder.instances.push(this);
  }

  start(): void {
    this.startSpy();
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.dispatchEvent(new Event('stop'));
  }

  emitData(size = 16): void {
    const event = new Event('dataavailable') as Event & { data: Blob };
    Object.defineProperty(event, 'data', { value: new Blob([new Uint8Array(size)]) });
    this.dispatchEvent(event);
  }

  emitError(): void {
    this.dispatchEvent(new Event('error'));
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('VoiceRecorderService', () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>;
  let queryMock: ReturnType<typeof vi.fn>;
  let mediaDevicesSpy: ReturnType<typeof vi.spyOn>;
  let permissionsSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let hiddenSpy: ReturnType<typeof vi.spyOn> | null;

  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    getUserMediaMock = vi.fn();
    queryMock = vi.fn();
    hiddenSpy = null;

    mediaDevicesSpy = vi
      .spyOn(navigator, 'mediaDevices', 'get')
      .mockReturnValue({ getUserMedia: getUserMediaMock } as unknown as MediaDevices);
    permissionsSpy = vi.spyOn(navigator, 'permissions', 'get').mockReturnValue({ query: queryMock } as unknown as Permissions);
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    logSpy = vi.spyOn(window, 'log').mockImplementation(() => undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mediaDevicesSpy.mockRestore();
    permissionsSpy.mockRestore();
    hiddenSpy?.mockRestore();
    logSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  function grantedService(trackCount = 2): { service: VoiceRecorderService; stream: FakeMediaStream } {
    queryMock.mockResolvedValue({ state: 'granted' });
    const stream = new FakeMediaStream(trackCount);
    getUserMediaMock.mockResolvedValue(stream);
    return { service: new VoiceRecorderService(), stream };
  }

  async function startAndRecord(trackCount = 2): Promise<{ service: VoiceRecorderService; stream: FakeMediaStream }> {
    const { service, stream } = grantedService(trackCount);
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    return { service, stream };
  }

  // [AC5]
  describe('[AC5] starting a recording with permission already granted', () => {
    it('should_move_status_idle_to_starting_to_recording_and_create_exactly_one_recorder', async () => {
      const { service } = grantedService();
      expect(service.status()).toBe('idle');

      service.start();
      expect(service.status()).toBe('starting');

      await vi.advanceTimersByTimeAsync(0);

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
      expect(FakeMediaRecorder.instances.length).toBe(1);
      expect(service.status()).toBe('recording');
    });
  });

  // [AC6]
  describe('[AC6] stopping after a 2s recording', () => {
    it('should_set_latest_to_a_voice_recording_with_a_non_empty_blob_matching_mimetype_and_duration', async () => {
      const { service } = await startAndRecord();
      const recorder = FakeMediaRecorder.instances[0];
      recorder.emitData(32);

      await vi.advanceTimersByTimeAsync(2000);
      service.stop();

      const latest = service.latest();
      expect(latest).not.toBeNull();
      expect(latest!.blob.size).toBeGreaterThan(0);
      expect(latest!.mimeType).toBe(recorder.mimeType);
      expect(latest!.durationMs).toBeGreaterThanOrEqual(1000);
      expect(latest!.recordedAt).toBeInstanceOf(Date);
      expect(service.status()).toBe('idle');
    });
  });

  // [AC7]
  describe('[AC7] a second valid recording', () => {
    it('should_replace_latest_so_the_previous_recording_is_no_longer_referenced', async () => {
      const { service } = await startAndRecord();
      FakeMediaRecorder.instances[0].emitData(32);
      await vi.advanceTimersByTimeAsync(2000);
      service.stop();
      const first = service.latest();
      expect(first).not.toBeNull();

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      FakeMediaRecorder.instances[1].emitData(32);
      await vi.advanceTimersByTimeAsync(2000);
      service.stop();

      const second = service.latest();
      expect(second).not.toBeNull();
      expect(second).not.toBe(first);
    });
  });

  // [AC8]
  describe('[AC8] a recording under 1000ms', () => {
    it('should_leave_latest_unchanged_and_report_too_short', async () => {
      const { service } = await startAndRecord();
      FakeMediaRecorder.instances[0].emitData(8);

      await vi.advanceTimersByTimeAsync(500);
      service.stop();

      expect(service.latest()).toBeNull();
      expect(service.lastOutcome()?.outcome).toBe('too-short');
      expect(service.status()).toBe('idle');
    });

    it('should_leave_a_previous_recording_untouched_when_the_next_hold_is_too_short', async () => {
      const { service } = await startAndRecord();
      FakeMediaRecorder.instances[0].emitData(32);
      await vi.advanceTimersByTimeAsync(2000);
      service.stop();
      const kept = service.latest();
      expect(kept).not.toBeNull();

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      FakeMediaRecorder.instances[1].emitData(8);
      await vi.advanceTimersByTimeAsync(500);
      service.stop();

      expect(service.latest()).toBe(kept);
      expect(service.lastOutcome()?.outcome).toBe('too-short');
    });
  });

  // [AC9]
  describe('[AC9] the 60s cap', () => {
    it('should_auto_stop_at_60000ms_keep_the_recording_report_limit_reached_and_return_to_idle', async () => {
      const { service } = await startAndRecord();
      FakeMediaRecorder.instances[0].emitData(32);

      await vi.advanceTimersByTimeAsync(60_000);

      expect(service.latest()).not.toBeNull();
      expect(service.lastOutcome()?.outcome).toBe('limit-reached');
      expect(service.status()).toBe('idle');
    });
  });

  // [AC10]
  describe('[AC10] every stop path releases every track', () => {
    it('should_stop_all_tracks_on_a_normal_stop', async () => {
      const { service, stream } = await startAndRecord();
      FakeMediaRecorder.instances[0].emitData(32);
      await vi.advanceTimersByTimeAsync(2000);
      service.stop();
      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });

    it('should_stop_all_tracks_when_the_recording_is_too_short', async () => {
      const { stream } = await startAndRecord();
      const service2 = FakeMediaRecorder.instances[0];
      void service2;
      await vi.advanceTimersByTimeAsync(500);
      FakeMediaRecorder.instances[0].stop();
      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });

    it('should_stop_all_tracks_when_the_60s_limit_is_reached', async () => {
      const { stream } = await startAndRecord();
      FakeMediaRecorder.instances[0].emitData(32);
      await vi.advanceTimersByTimeAsync(60_000);
      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });

    it('should_stop_all_tracks_when_the_recorder_raises_error', async () => {
      const { stream } = await startAndRecord();
      FakeMediaRecorder.instances[0].emitError();
      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });

    it('should_stop_all_tracks_on_visibilitychange_to_hidden', async () => {
      const { stream } = await startAndRecord();
      hiddenSpy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

      document.dispatchEvent(new Event('visibilitychange'));

      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });
  });

  // [AC11]
  describe('[AC11] stop() while starting on the record path (getUserMedia not yet resolved)', () => {
    it('should_stop_all_tracks_start_no_recorder_and_leave_latest_unchanged_once_it_resolves', async () => {
      queryMock.mockResolvedValue({ state: 'granted' });
      const pending = deferred<FakeMediaStream>();
      getUserMediaMock.mockReturnValue(pending.promise);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0); // past permission resolution; getUserMedia in flight
      expect(service.status()).toBe('starting');

      service.stop(); // flags the pending start as cancelled

      const stream = new FakeMediaStream(2);
      pending.resolve(stream);
      await vi.advanceTimersByTimeAsync(0);

      expect(FakeMediaRecorder.instances.length).toBe(0);
      expect(service.latest()).toBeNull();
      expect(service.status()).toBe('idle');
      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });
  });

  // [AC12]
  describe('[AC12] getUserMedia rejection classification on the record path', () => {
    it('should_report_denied_for_notallowederror', async () => {
      queryMock.mockResolvedValue({ state: 'granted' });
      getUserMediaMock.mockRejectedValue(new DOMException('nope', 'NotAllowedError'));
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.lastOutcome()?.outcome).toBe('denied');
      expect(logSpy).toHaveBeenCalled();
      expect(service.latest()).toBeNull();
      expect(service.status()).toBe('idle');
    });

    it('should_report_no_device_for_notfounderror', async () => {
      queryMock.mockResolvedValue({ state: 'granted' });
      getUserMediaMock.mockRejectedValue(new DOMException('nope', 'NotFoundError'));
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.lastOutcome()?.outcome).toBe('no-device');
      expect(logSpy).toHaveBeenCalled();
      expect(service.latest()).toBeNull();
      expect(service.status()).toBe('idle');
    });

    it('should_report_failed_for_any_other_error', async () => {
      queryMock.mockResolvedValue({ state: 'granted' });
      getUserMediaMock.mockRejectedValue(new DOMException('nope', 'NotReadableError'));
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.lastOutcome()?.outcome).toBe('failed');
      expect(logSpy).toHaveBeenCalled();
      expect(service.latest()).toBeNull();
      expect(service.status()).toBe('idle');
    });
  });

  // [AC13]
  describe('[AC13] unsupported environment', () => {
    it('should_report_unsupported_and_never_call_getusermedia_when_mediadevices_is_missing', async () => {
      mediaDevicesSpy.mockReturnValue(undefined as unknown as MediaDevices);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.lastOutcome()?.outcome).toBe('unsupported');
      expect(logSpy).toHaveBeenCalled();
      expect(getUserMediaMock).not.toHaveBeenCalled();
      expect(service.status()).toBe('idle');
    });

    it('should_report_unsupported_and_never_call_getusermedia_when_mediarecorder_is_missing', async () => {
      vi.stubGlobal('MediaRecorder', undefined);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.lastOutcome()?.outcome).toBe('unsupported');
      expect(logSpy).toHaveBeenCalled();
      expect(getUserMediaMock).not.toHaveBeenCalled();
      expect(service.status()).toBe('idle');
    });
  });

  // [AC14]
  describe('[AC14] repeated start()/stop() calls that must be no-ops', () => {
    it('should_ignore_a_second_start_while_recording_leaving_one_getusermedia_call_and_one_recorder', async () => {
      const { service } = await startAndRecord();
      expect(service.status()).toBe('recording');

      service.start();

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(FakeMediaRecorder.instances.length).toBe(1);
    });

    it('should_ignore_a_second_start_while_requesting_leaving_one_getusermedia_call', async () => {
      queryMock.mockResolvedValue({ state: 'prompt' });
      const pending = deferred<FakeMediaStream>();
      getUserMediaMock.mockReturnValue(pending.promise);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.status()).toBe('requesting');

      service.start();

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(FakeMediaRecorder.instances.length).toBe(0);
    });

    it('should_do_nothing_when_stop_is_called_while_idle', () => {
      const service = new VoiceRecorderService();
      expect(service.status()).toBe('idle');

      expect(() => service.stop()).not.toThrow();
      expect(service.status()).toBe('idle');
      expect(service.latest()).toBeNull();
    });
  });

  // [AC15]
  describe('[AC15] no persistence and no HTTP', () => {
    it('should_inject_without_a_store_or_httpclient_provider_and_make_no_http_request_during_a_full_record_cycle', async () => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()]
      });

      // If the service ever injected Store (not provided here), this would throw
      // NullInjectorError before reaching the assertions below.
      const service = TestBed.inject(VoiceRecorderService);
      const httpMock = TestBed.inject(HttpTestingController);

      const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
      const sessionStorageSpy = vi.spyOn(window.sessionStorage, 'setItem');

      queryMock.mockResolvedValue({ state: 'granted' });
      const stream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(stream);

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      FakeMediaRecorder.instances[0].emitData(32);
      await vi.advanceTimersByTimeAsync(2000);
      service.stop();

      expect(service.latest()).not.toBeNull();
      httpMock.expectNone(() => true);
      expect(localStorageSpy).not.toHaveBeenCalled();
      expect(sessionStorageSpy).not.toHaveBeenCalled();

      localStorageSpy.mockRestore();
      sessionStorageSpy.mockRestore();
    });
  });

  // [AC26]
  describe('[AC26] permission-first press: prompt/unknown state with no in-memory grant', () => {
    it('should_go_requesting_call_getusermedia_once_stop_all_tracks_create_no_recorder_and_report_permission_granted', async () => {
      queryMock.mockResolvedValue({ state: 'prompt' });
      const stream = new FakeMediaStream(2);
      getUserMediaMock.mockResolvedValue(stream);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true });
      expect(FakeMediaRecorder.instances.length).toBe(0);
      expect(service.latest()).toBeNull();
      expect(service.lastOutcome()?.outcome).toBe('permission-granted');
      expect(service.status()).toBe('idle');
      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });

    it('should_take_the_same_permission_only_path_when_permissions_query_is_missing', async () => {
      permissionsSpy.mockReturnValue(undefined as unknown as Permissions);
      const stream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(stream);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(FakeMediaRecorder.instances.length).toBe(0);
      expect(service.lastOutcome()?.outcome).toBe('permission-granted');
      expect(service.status()).toBe('idle');
    });

    it('should_take_the_same_permission_only_path_when_permissions_query_rejects', async () => {
      queryMock.mockRejectedValue(new Error('not supported'));
      const stream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(stream);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(FakeMediaRecorder.instances.length).toBe(0);
      expect(service.lastOutcome()?.outcome).toBe('permission-granted');
      expect(service.status()).toBe('idle');
    });
  });

  // [AC27]
  describe('[AC27] stop() cannot cancel a permission request', () => {
    it('should_not_cancel_while_requesting_the_outcome_matches_AC26', async () => {
      queryMock.mockResolvedValue({ state: 'prompt' });
      const pending = deferred<FakeMediaStream>();
      getUserMediaMock.mockReturnValue(pending.promise);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.status()).toBe('requesting');

      service.stop(); // must not cancel

      const stream = new FakeMediaStream(1);
      pending.resolve(stream);
      await vi.advanceTimersByTimeAsync(0);

      expect(FakeMediaRecorder.instances.length).toBe(0);
      expect(service.latest()).toBeNull();
      expect(service.lastOutcome()?.outcome).toBe('permission-granted');
      expect(service.status()).toBe('idle');
      stream.getTracks().forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    });

    it('should_not_cancel_while_starting_before_the_permission_state_is_known', async () => {
      const pendingQuery = deferred<{ state: string }>();
      queryMock.mockReturnValue(pendingQuery.promise);
      const service = new VoiceRecorderService();

      service.start();
      expect(service.status()).toBe('starting');

      service.stop(); // must not cancel: the permission state is not resolved yet

      const stream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(stream);
      pendingQuery.resolve({ state: 'granted' });
      await vi.advanceTimersByTimeAsync(0);

      // Unaffected by the earlier stop(): the record path completes normally.
      expect(FakeMediaRecorder.instances.length).toBe(1);
      expect(service.status()).toBe('recording');
    });
  });

  // [AC28]
  describe('[AC28] the next start() after a granted permission takes the record path', () => {
    it('should_call_getusermedia_once_more_and_create_one_recorder_ending_in_recording', async () => {
      queryMock.mockResolvedValue({ state: 'prompt' });
      const permissionStream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(permissionStream);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.lastOutcome()?.outcome).toBe('permission-granted');
      expect(getUserMediaMock).toHaveBeenCalledTimes(1);

      const recordStream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(recordStream);

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(getUserMediaMock).toHaveBeenCalledTimes(2);
      expect(FakeMediaRecorder.instances.length).toBe(1);
      expect(service.status()).toBe('recording');
    });

    it('should_also_work_without_the_permissions_api_through_the_in_memory_grant', async () => {
      permissionsSpy.mockReturnValue(undefined as unknown as Permissions);
      const permissionStream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(permissionStream);
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.lastOutcome()?.outcome).toBe('permission-granted');

      const recordStream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(recordStream);

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(getUserMediaMock).toHaveBeenCalledTimes(2);
      expect(FakeMediaRecorder.instances.length).toBe(1);
      expect(service.status()).toBe('recording');
    });
  });

  // [AC29]
  describe('[AC29] permission denied handling', () => {
    it('should_report_denied_log_and_never_call_getusermedia_when_permissions_api_reports_denied', async () => {
      queryMock.mockResolvedValue({ state: 'denied' });
      const service = new VoiceRecorderService();

      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.lastOutcome()?.outcome).toBe('denied');
      expect(logSpy).toHaveBeenCalled();
      expect(getUserMediaMock).not.toHaveBeenCalled();
      expect(service.latest()).toBeNull();
      expect(service.status()).toBe('idle');
    });

    it('should_clear_the_in_memory_grant_on_a_notallowederror_so_the_next_press_is_permission_only_again', async () => {
      permissionsSpy.mockReturnValue(undefined as unknown as Permissions); // rely on the in-memory flag only
      const permissionStream = new FakeMediaStream(1);
      getUserMediaMock.mockResolvedValue(permissionStream);
      const service = new VoiceRecorderService();

      // 1) permission-only press grants the in-memory flag.
      service.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.lastOutcome()?.outcome).toBe('permission-granted');

      // 2) record path press is revoked.
      getUserMediaMock.mockRejectedValue(new DOMException('nope', 'NotAllowedError'));
      service.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.lastOutcome()?.outcome).toBe('denied');
      expect(FakeMediaRecorder.instances.length).toBe(0);

      // 3) the next press is permission-only again (status goes to 'requesting', not straight
      // to a new getUserMedia recorder call for a stream).
      getUserMediaMock.mockResolvedValue(new FakeMediaStream(1));
      service.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.lastOutcome()?.outcome).toBe('permission-granted');
      expect(FakeMediaRecorder.instances.length).toBe(0);
    });
  });
});
