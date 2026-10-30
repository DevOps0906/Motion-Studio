'use client';
import {useEffect} from 'react';
import {loadProductionSettings,PRODUCTION_SETTINGS_KEY} from '../lib/production-settings';
export default function AppTheme(){useEffect(()=>{const apply=()=>{document.documentElement.dataset.appTheme=loadProductionSettings().appTheme;};apply();const sync=(event:StorageEvent)=>{if(event.key===PRODUCTION_SETTINGS_KEY||event.key===null)apply();};window.addEventListener('storage',sync);window.addEventListener('production-settings-changed',apply);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('production-settings-changed',apply);};},[]);return null;}
