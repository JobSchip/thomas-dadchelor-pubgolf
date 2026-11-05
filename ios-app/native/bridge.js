import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// This code only ships in the native package. The website stays dependency-free.
if (Capacitor.isNativePlatform()) {
  let photoBusy = false;

  window.addEventListener('pubgolf:haptic', async (event) => {
    const kind = event.detail?.kind || 'light';
    try {
      if (kind === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (kind === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      } else {
        const style = kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
    } catch (error) {
      console.debug('Haptics unavailable', error);
    }
  });

  window.addEventListener('pubgolf:choose-photo', async () => {
    if (photoBusy) return;
    photoBusy = true;
    try {
      const result = await Camera.getPhoto({
        quality: 82,
        allowEditing: false,
        correctOrientation: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt
      });
      if (result.dataUrl) {
        const imageResponse = await fetch(result.dataUrl);
        const blob = await imageResponse.blob();
        const file = new File([blob], 'pubgolf-profile.jpg', { type: blob.type || 'image/jpeg' });
        window.dispatchEvent(new CustomEvent('pubgolf:photo-selected', { detail: { file } }));
      }
    } catch (error) {
      // Canceling the system picker is expected and should not show an error.
      if (!/cancel/i.test(String(error?.message || error))) {
        window.dispatchEvent(new Event('pubgolf:photo-error'));
      }
    } finally {
      photoBusy = false;
    }
  });
}
