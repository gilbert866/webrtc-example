/**
 * Hardware Device Settings Modal.
 * Allows users to inspect and switch Camera, Microphone, and Audio Output devices.
 */

import { Modal } from '../../../shared/ui/modal.js';
import { icons } from '../../../shared/ui/icons.js';
import { mediaState } from '../state/media-state.js';
import { mediaDeviceService } from '../api/media-devices.js';
import { toast } from '../../../shared/ui/toast.js';

export function openDeviceSettingsModal(onDeviceChanged) {
  const state = mediaState.get();
  const { audioInputs, videoInputs, audioOutputs } = state.availableDevices;

  const content = `
    <div class="device-settings-form">
      <!-- Microphone Picker -->
      <div class="input-group">
        <label class="input-label" for="select-audio-input">Microphone</label>
        <select id="select-audio-input" class="input-select">
          ${audioInputs.map(d => `
            <option value="${d.deviceId}" ${d.deviceId === state.activeAudioDeviceId ? 'selected' : ''}>
              ${d.label || `Microphone (${d.deviceId.slice(0, 8)})`}
            </option>
          `).join('') || '<option value="">Default Microphone</option>'}
        </select>
      </div>

      <!-- Live Mic Level Test -->
      <div class="input-group" style="margin-top: -6px; margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted); margin-bottom: 4px;">
          <span>Microphone Input Level</span>
          <span id="mic-test-val">Active</span>
        </div>
        <div style="height: 6px; width: 100%; background: rgba(255,255,255,0.08); border-radius: var(--radius-pill); overflow: hidden;">
          <div id="mic-test-bar" style="height: 100%; width: 0%; background: var(--color-success); transition: width 0.05s ease;"></div>
        </div>
      </div>

      <!-- Camera Picker -->
      <div class="input-group">
        <label class="input-label" for="select-video-input">Camera</label>
        <select id="select-video-input" class="input-select">
          ${videoInputs.map(d => `
            <option value="${d.deviceId}" ${d.deviceId === state.activeVideoDeviceId ? 'selected' : ''}>
              ${d.label || `Camera (${d.deviceId.slice(0, 8)})`}
            </option>
          `).join('') || '<option value="">Default Camera</option>'}
        </select>
      </div>

      <!-- Speaker Picker (if supported) -->
      ${audioOutputs.length > 0 ? `
        <div class="input-group">
          <label class="input-label" for="select-audio-output">Speaker / Audio Output</label>
          <select id="select-audio-output" class="input-select">
            ${audioOutputs.map(d => `
              <option value="${d.deviceId}" ${d.deviceId === state.activeAudioOutputDeviceId ? 'selected' : ''}>
                ${d.label || `Speaker (${d.deviceId.slice(0, 8)})`}
              </option>
            `).join('')}
          </select>
        </div>
      ` : ''}
    </div>
  `;

  const footer = `
    <button class="btn btn-primary" id="btn-save-devices">Done</button>
  `;

  const modal = new Modal({
    title: `${icons.settings('', 18)} Device Settings`,
    content,
    footer,
    onOpen: (el) => {
      const audioSelect = el.querySelector('#select-audio-input');
      const videoSelect = el.querySelector('#select-video-input');
      const outputSelect = el.querySelector('#select-audio-output');
      const saveBtn = el.querySelector('#btn-save-devices');

      saveBtn?.addEventListener('click', async () => {
        const newAudioId = audioSelect?.value;
        const newVideoId = videoSelect?.value;
        const newOutputId = outputSelect?.value;

        try {
          if (newAudioId && newAudioId !== state.activeAudioDeviceId) {
            mediaState.setActiveAudioDevice(newAudioId);
            if (onDeviceChanged) await onDeviceChanged('audio', newAudioId);
          }
          if (newVideoId && newVideoId !== state.activeVideoDeviceId) {
            mediaState.setActiveVideoDevice(newVideoId);
            if (onDeviceChanged) await onDeviceChanged('video', newVideoId);
          }
          if (newOutputId && newOutputId !== state.activeAudioOutputDeviceId) {
            mediaState.setActiveAudioOutputDevice(newOutputId);
            if (onDeviceChanged) await onDeviceChanged('output', newOutputId);
          }
          toast.success('Device preferences updated');
        } catch (err) {
          toast.error('Failed to switch device');
        }

        modal.close();
      });
    }
  });

  return modal.render();
}
