'use strict';

async function isWhatsAppWebReady(client, timeoutMs=5000) {
  let timeout;
  try {
    if (!client.pupBrowser?.isConnected() || !client.pupPage || client.pupPage.isClosed()) return false;
    return await Promise.race([
      client.pupPage.evaluate(() => window.AuthStore?.AppState?.state === 'CONNECTED'
        && Boolean(window.AuthStore?.AppState?.hasSynced)
        && typeof window.onAddMessageEvent === 'function'),
      new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('browser timeout')),timeoutMs);})
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function createBrowserHealthMonitor({client,isEnabled,onUnhealthy,intervalMs=10000,timeoutMs=5000,maxFailures=3,logger=console}) {
  let failures=0, busy=false, stopped=false;
  async function check() {
    if (busy || stopped || !isEnabled()) return;
    busy=true;
    let timeout;
    try {
      if (!client.pupBrowser?.isConnected() || !client.pupPage || client.pupPage.isClosed()) {
        throw new Error('browser closed');
      }
      const responsive = await isWhatsAppWebReady(client,timeoutMs);
      if (!responsive) throw new Error('browser disconnected');
      failures=0;
    } catch {
      failures++;
      logger.warn('Navegador do WhatsApp sem resposta: tentativa '+failures+'/'+maxFailures);
      if (failures>=maxFailures) {
        stop();
        onUnhealthy();
      }
    } finally {
      clearTimeout(timeout);
      busy=false;
    }
  }
  const timer=setInterval(()=>void check(),intervalMs);
  timer.unref();
  function stop() {stopped=true;clearInterval(timer);}
  return {check,stop};
}

module.exports={createBrowserHealthMonitor,isWhatsAppWebReady};
