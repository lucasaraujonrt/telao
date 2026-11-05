(function (root) {
  const preferences = { primary: 4, thumbnail: 1, hidden: 0.15 };
  const defaultProfile = { fps: 60, bitrate: 4_000_000, motion: true };

  function chooseEncoding(profile, preference, rung, budget) {
    const level = Math.max(0, Math.min(2, rung));
    const thumbnail = preference === "thumbnail", hidden = preference === "hidden";
    const scale = hidden ? 4 : thumbnail ? 3 : [1, 1.5, 2][level];
    const ceiling = hidden ? 120_000 : thumbnail ? 600_000 : profile.bitrate * [1, 0.65, 0.4][level];
    return {
      maxBitrate: Math.max(0, Math.floor(Math.min(budget, ceiling))),
      maxFramerate: Math.min(profile.fps, hidden ? 2 : thumbnail ? 15 : level ? 30 : profile.fps),
      scaleResolutionDownBy: scale,
      degradationPreference: profile.motion ? "maintain-framerate" : "maintain-resolution",
    };
  }

  function allocateEncodings(profile, streams, uploadBudget) {
    const weight = streams.reduce((sum, stream) => sum + preferences[stream.preference], 0);
    return new Map(streams.map(stream => [stream.peerId, chooseEncoding(profile, stream.preference, stream.rung,
      Math.floor(uploadBudget * preferences[stream.preference] / weight))]));
  }

  function createStreamController({ uploadBudget = 8_000_000, sampleInterval = 3000 } = {}) {
    if (!Number.isFinite(uploadBudget) || uploadBudget < 1 || !Number.isFinite(sampleInterval) || sampleInterval < 0) throw new TypeError("Invalid stream budget or interval");
    const streams = new Map();
    let profile = defaultProfile, timer = null, sampling = false;
    const current = state => streams.get(state.peerId) === state;
    const settle = () => Promise.all([...streams.values()].map(state => state.queue));

    function schedule() {
      if (timer !== null || sampling || !streams.size || !sampleInterval) return;
      timer = setTimeout(() => { timer = null; sample(); }, sampleInterval);
      timer.unref?.();
    }

    async function apply(state) {
      if (!current(state)) return;
      const senders = state.call.peerConnection?.getSenders().filter(sender => sender.track?.kind === "video") || [];
      for (const sender of senders) {
        if (!current(state)) return;
        const desired = state.desired;
        const key = JSON.stringify(desired);
        if (state.applied.get(sender) === key) continue;
        try {
          const parameters = sender.getParameters();
          if (!parameters.encodings?.length) continue;
          const update = parameters => {
            for (const encoding of parameters.encodings) {
              encoding.maxBitrate = Math.max(0, Math.floor(desired.maxBitrate / senders.length / parameters.encodings.length));
              encoding.maxFramerate = desired.maxFramerate;
              encoding.scaleResolutionDownBy = desired.scaleResolutionDownBy;
            }
            if (!state.omitDegradation) parameters.degradationPreference = desired.degradationPreference;
            else delete parameters.degradationPreference;
          };
          update(parameters);
          try { await sender.setParameters(parameters); }
          catch (error) {
            if (!current(state) || state.omitDegradation || !["TypeError", "NotSupportedError"].includes(error.name)) continue;
            state.omitDegradation = true;
            const fresh = sender.getParameters();
            if (!fresh.encodings?.length) continue;
            update(fresh);
            await sender.setParameters(fresh);
          }
          if (current(state)) state.applied.set(sender, key);
        } catch {}
      }
    }

    function refresh() {
      const encodings = allocateEncodings(profile, [...streams.values()], uploadBudget);
      for (const state of streams.values()) {
        state.desired = encodings.get(state.peerId);
        state.queue = state.queue.then(() => apply(state)).catch(() => {});
      }
      return settle();
    }

    async function sample() {
      if (sampling) return settle();
      sampling = true;
      try {
        await Promise.all([...streams.values()].map(async state => {
          if (!current(state)) return;
          try {
            const report = await state.call.peerConnection?.getStats();
            if (!current(state) || !report) return;
            let observed = false, pressure = false;
            report.forEach(stat => {
              if (stat.type !== "outbound-rtp" || stat.isRemote || (stat.kind || stat.mediaType) !== "video") return;
              if (["none", "cpu", "bandwidth"].includes(stat.qualityLimitationReason)) observed = true;
              if (["cpu", "bandwidth"].includes(stat.qualityLimitationReason)) pressure = true;
            });
            if (!observed) { state.pressure = 0; state.healthy = 0; return; }
            state.pressure = pressure ? state.pressure + 1 : 0;
            state.healthy = pressure ? 0 : state.healthy + 1;
            if (state.pressure >= 3) { state.rung = Math.min(2, state.rung + 1); state.pressure = 0; }
            if (state.healthy >= 6) { state.rung = Math.max(0, state.rung - 1); state.healthy = 0; }
          } catch { state.pressure = 0; state.healthy = 0; }
        }));
        await refresh();
      } finally { sampling = false; schedule(); }
    }

    function remove(peerId, call) {
      const state = streams.get(peerId);
      if (!state || (call && state.call !== call)) return settle();
      state.call.peerConnection?.removeEventListener?.("connectionstatechange", state.connected);
      streams.delete(peerId);
      if (!streams.size && timer !== null) { clearTimeout(timer); timer = null; }
      return refresh();
    }

    function add(peerId, call) {
      if (streams.get(peerId)?.call === call) return refresh();
      remove(peerId);
      const state = { peerId, call, preference: "primary", rung: 0, pressure: 0, healthy: 0, queue: Promise.resolve(), applied: new WeakMap(), omitDegradation: false, desired: null };
      state.connected = () => {
        if (!current(state)) return;
        const connectionState = call.peerConnection?.connectionState;
        if (connectionState === "closed" || connectionState === "failed") remove(peerId, call);
        else if (connectionState === "connected") { state.applied = new WeakMap(); refresh(); }
      };
      streams.set(peerId, state);
      call.peerConnection?.addEventListener?.("connectionstatechange", state.connected);
      call.on?.("close", () => remove(peerId, call));
      schedule();
      return refresh();
    }

    function setProfile(next) {
      if (!next || !Number.isFinite(next.fps) || next.fps < 1 || !Number.isFinite(next.bitrate) || next.bitrate < 1) throw new TypeError("Invalid stream profile");
      profile = { fps: next.fps, bitrate: next.bitrate, motion: !!next.motion };
      for (const state of streams.values()) { state.rung = 0; state.pressure = 0; state.healthy = 0; }
      return refresh();
    }

    function setPreference(peerId, preference) {
      if (!Object.hasOwn(preferences, preference)) return settle();
      const state = streams.get(peerId);
      if (!state || state.preference === preference) return settle();
      state.preference = preference;
      return refresh();
    }

    function stop() {
      for (const state of streams.values()) state.call.peerConnection?.removeEventListener?.("connectionstatechange", state.connected);
      streams.clear();
      if (timer !== null) clearTimeout(timer);
      timer = null;
    }

    return { setProfile, add, setPreference, remove, stop, refresh, sample };
  }

  // Chrome offers VP8 first, which most PCs encode and decode on the CPU. H.264 usually runs on
  // the graphics chip, so moving it to the front of the video line cuts CPU for sharer and viewers.
  // Every other codec stays in the offer, so a browser without H.264 still connects.
  function preferH264(sdp) {
    if (typeof sdp !== "string") return sdp;
    const eol = sdp.includes("\r\n") ? "\r\n" : "\n";
    const lines = sdp.split(eol);
    const start = lines.findIndex(line => line.startsWith("m=video "));
    if (start < 0) return sdp;
    const end = lines.findIndex((line, i) => i > start && line.startsWith("m="));
    const section = lines.slice(start, end < 0 ? lines.length : end);
    const h264 = new Set();
    for (const line of section) {
      const match = /^a=rtpmap:(\d+) H264\//.exec(line);
      if (match) h264.add(match[1]);
    }
    if (!h264.size) return sdp;
    // Constrained baseline (42e0xx) is the profile hardware handles best, so it leads the H.264 group.
    const baseline = new Set();
    for (const line of section) {
      const match = /^a=fmtp:(\d+) .*profile-level-id=42e0/i.exec(line);
      if (match && h264.has(match[1])) baseline.add(match[1]);
    }
    const parts = lines[start].split(" ");
    const payloads = parts.slice(3);
    const rank = pt => baseline.has(pt) ? 0 : h264.has(pt) ? 1 : 2;
    const sorted = payloads.map((pt, i) => [pt, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([pt]) => pt);
    lines[start] = [...parts.slice(0, 3), ...sorted].join(" ");
    return lines.join(eol);
  }

  const api = { createStreamController, chooseEncoding, allocateEncodings, preferH264 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TelaoStreaming = api;
})(globalThis);
