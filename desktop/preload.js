'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('get-state'),
  save: (payload) => ipcRenderer.invoke('save', payload),
  connect: () => ipcRenderer.invoke('connect'),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  logout: () => ipcRenderer.invoke('logout'),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  openLog: () => ipcRenderer.invoke('open-log'),
  copy: (text) => ipcRenderer.invoke('copy', text),
  openCampusBrowser: () => ipcRenderer.invoke('open-campus-browser'),
  resize: (height) => ipcRenderer.invoke('resize', height),
  onStatus: (cb) => ipcRenderer.on('status', (_e, s) => cb(s)),
});
