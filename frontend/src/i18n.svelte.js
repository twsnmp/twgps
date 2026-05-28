const translations = {
  en: {
    status: {
      locked: "GPS Locked",
      scanning: "Scanning Ports...",
      searching: "Searching Satellites..."
    },
    nav: {
      theme: "Toggle Theme",
      lang: "Language"
    },
    panels: {
      position: "Position Matrix",
      time: "Time Matrix",
      ntp: "NTP Server",
      receiver: "Receiver Interface",
      satellites: "Satellite Matrix"
    },
    pos: {
      latitude: "Latitude",
      longitude: "Longitude",
      altitude: "Altitude (MSL)",
      speed: "Speed"
    },
    time: {
      local: "Local Time",
      utc: "UTC Time"
    },
    ntp: {
      status: "Server Status",
      online: "ONLINE",
      offline: "OFFLINE",
      port: "Server Port",
      clients: "Clients Connected",
      refId: "Reference ID",
      stop: "Stop Time Server",
      start: "Start Time Server"
    },
    rcv: {
      active: "Active Port",
      scanning: "Scanning...",
      rescan: "Rescan Ports"
    },
    sat: {
      empty: "Searching for GPS receiver or satellite signals...",
      noSig: "No Sig"
    },
    systems: {
      "GPS": "GPS",
      "GLONASS": "GLONASS",
      "Galileo": "Galileo",
      "BeiDou": "BeiDou",
      "みちびき(QZ)": "QZSS (MICHIBIKI)",
      "補正信号(SBAS/MSAS)": "SBAS/MSAS"
    }
  },
  ja: {
    status: {
      locked: "GPS ロック完了",
      scanning: "ポート走査中...",
      searching: "衛星を探索中..."
    },
    nav: {
      theme: "テーマ切り替え",
      lang: "言語"
    },
    panels: {
      position: "位置マトリクス",
      time: "時間マトリクス",
      ntp: "NTP サーバー",
      receiver: "レシーバーインターフェース",
      satellites: "衛星マトリクス"
    },
    pos: {
      latitude: "緯度",
      longitude: "経度",
      altitude: "高度 (平均海面)",
      speed: "速度"
    },
    time: {
      local: "ローカル時刻",
      utc: "協定世界時 (UTC)"
    },
    ntp: {
      status: "サーバー状態",
      online: "オンライン",
      offline: "オフライン",
      port: "サーバーポート",
      clients: "接続中のクライアント",
      refId: "参照元 ID",
      stop: "タイムサーバー停止",
      start: "タイムサーバー起動"
    },
    rcv: {
      active: "アクティブポート",
      scanning: "走査中...",
      rescan: "ポート再走査"
    },
    sat: {
      empty: "GPS レシーバーまたは衛星信号を検索中...",
      noSig: "信号なし"
    },
    systems: {
      "GPS": "GPS",
      "GLONASS": "GLONASS",
      "Galileo": "Galileo",
      "BeiDou": "BeiDou",
      "みちびき(QZ)": "みちびき(QZSS)",
      "補正信号(SBAS/MSAS)": "補正信号(SBAS/MSAS)"
    }
  }
};

function detectOSLanguage() {
  const lang = typeof navigator !== 'undefined' ? (navigator.language || navigator.languages[0]) : 'en';
  return lang.startsWith('ja') ? 'ja' : 'en';
}

class I18nManager {
  currentLocale = $state(detectOSLanguage());

  setLocale(lang) {
    if (translations[lang]) {
      this.currentLocale = lang;
    }
  }

  t(path) {
    const keys = path.split('.');
    let translation = translations[this.currentLocale];
    for (const key of keys) {
      if (translation && translation[key] !== undefined) {
        translation = translation[key];
      } else {
        return keys[keys.length - 1];
      }
    }
    return translation;
  }
}

export const i18n = new I18nManager();
