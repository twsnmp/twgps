const translations = {
  en: {
    status: {
      locked: "GPS Locked",
      scanning: "Scanning Ports...",
      searching: "Searching Satellites..."
    },
    nav: {
      theme: "Toggle Theme",
      lang: "Language",
      dashboard: "GPS / NTP",
      calendarMoon: "Calendar & Moon"
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
      start: "Start Time Server",
      startError: "Failed to start NTP Server. Make sure the port is not in use and that you have sufficient administrator privileges."
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
      lang: "言語",
      dashboard: "GPS / NTP",
      calendarMoon: "暦・月"
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
      start: "タイムサーバー起動",
      startError: "NTPサーバーの起動に失敗しました。ポートが他のプロセスに使用されていないこと、および十分な管理者権限があることを確認してください。"
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
    },
    cal: {
      liveMode: "リアルタイム (GPS / システム)",
      customMode: "任意の日時・地点を指定",
      resetLive: "現在時刻に戻す",
      dateTime: "日時",
      latitude: "緯度",
      longitude: "経度",
      usingGpsLoc: "GPS測位地点",
      usingDefaultLoc: "デフォルト地点 (東京)",
      japaneseTitle: "日本のこよみ・伝統暦注",
      worldTitle: "世界の暦 (Fourmilab準拠)",
      wareki: "和暦",
      koki: "皇紀",
      kyureki: "旧暦 (天保暦準拠)",
      leapMonth: "閏",
      rokuyo: "六曜",
      solarTerm: "二十四節気",
      nextTerm: "次節",
      zassetsu: "雑節",
      etoYear: "年干支",
      etoMonth: "月干支",
      etoDay: "日干支",
      natchin: "納音",
      kyuseiYear: "年九星",
      kyuseiDay: "日九星",
      junichoku: "十二直",
      nijuhasshuku: "二十八宿",
      senjitsu: "選日・吉凶日",
      none: "なし",
      gregorian: "グレゴリオ暦 (西暦)",
      julian: "ユリウス暦",
      julianDay: "ユリウス通日 (JD)",
      mjd: "修正ユリウス日 (MJD)",
      isoWeek: "ISO 週日付 / 年通算日",
      hebrew: "ユダヤ暦",
      islamic: "イスラム暦 (ヒジュラ暦)",
      persian: "ペルシャ暦 (イラン暦)",
      bahai: "バハーイー暦",
      indian: "インド国定暦 (サカ暦)",
      french: "フランス共和暦",
      mayan: "マヤ暦 (長期・ハアブ・ツォルキン)",
      beforeEpoch: "紀元前"
    },
    moon: {
      title: "月の見え方と位置",
      skyDomeTitle: "全天位置図 (方位角・高度)",
      observerOrientation: "観測地の傾きを再現",
      northUpOrientation: "天の北極を上",
      age: "現在月齢",
      noonAge: "正午月齢",
      days: "日",
      illumination: "輝面比",
      distance: "地心距離",
      angularSize: "視直径",
      azimuth: "方位角",
      altitude: "高度",
      belowHorizon: "地平線下",
      aboveHorizon: "地平線上",
      moonrise: "月の出",
      moonTransit: "月の南中",
      moonset: "月の入",
      sunrise: "日の出",
      solarNoon: "太陽南中",
      sunset: "日の入",
      dayLength: "昼の長さ",
      nextPhases: "今後の主な月相",
      sunLabel: "太陽",
      moonLabel: "月",
      phases: {
        new: "新月",
        waxingCrescent: "三日月・眉月",
        firstQuarter: "上弦の月",
        waxingGibbous: "十三夜・膨らむ月",
        full: "満月",
        waningGibbous: "十六夜〜更待月",
        thirdQuarter: "下弦の月",
        waningCrescent: "有明月"
      },
      trad: {
        shingetsu: "新月 (朔)",
        sengetsu: "繊月",
        mikazuki: "三日月",
        jogen: "上弦",
        tokaya: "十日夜",
        jusanya: "十三夜",
        komochizuki: "小望月",
        mangetsu: "満月 (望)",
        izayoi: "十六夜",
        tachimachizuki: "立待月",
        imachizuki: "居待月",
        nemachizuki: "寝待月",
        fukemachizuki: "更待月",
        kagen: "下弦",
        ariakezuki: "有明月",
        tsugomori: "晦",
        waxing: "満ちる月",
        waning: "欠ける月"
      }
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
