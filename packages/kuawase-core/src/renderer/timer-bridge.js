function installTimerBridge(windowObject) {
  if (!windowObject?.electron || !document?.getElementById) {
    return;
  }

  function createTimerRuntime(options) {
    let countdown = null;
    let remainingTime = options.initialTime;
    let initialTime = options.initialTime;
    let isRunning = false;
    let soundPlayed = false;

    function setExpiredClass(enabled) {
      const block = document.getElementById(options.displayId)?.closest(".timer-block");
      if (block) {
        block.classList.toggle("timer-expired", enabled);
      }
    }

    function updateDisplay() {
      options.renderDisplay(remainingTime);
      if (options.warningId) {
        const warning = document.getElementById(options.warningId);
        if (warning) {
          if (remainingTime <= 60 && remainingTime > 0) {
            warning.textContent = windowObject.t ? windowObject.t("minwarn") : "";
          } else if (remainingTime === 0) {
            warning.textContent = windowObject.t ? windowObject.t("minfin") : "";
          } else {
            warning.textContent = "";
          }
        }
      }
    }

    async function playAlarm() {
      let played = false;
      if (windowObject.electron?.getBgmConfig) {
        const bgm = await windowObject.electron.getBgmConfig();
        if (bgm[options.bgmKey]) {
          const path = await windowObject.electron.invoke("get-music-file-path", bgm[options.bgmKey]);
          let audio = document.getElementById(options.audioId);
          if (!audio) {
            audio = document.createElement("audio");
            audio.id = options.audioId;
            document.body.appendChild(audio);
          }
          audio.src = path;
          audio.muted = false;
          audio.currentTime = 0;
          await audio.play();
          played = true;
        }
      }
      if (!played) {
        const alarm = document.getElementById(options.fallbackAlarmId);
        if (alarm) {
          alarm.play();
        }
      }
    }

    function stopAlarm() {
      const audio = document.getElementById(options.audioId);
      if (audio) {
        audio.pause();
        audio.remove();
      }
      const alarm = document.getElementById(options.fallbackAlarmId);
      if (alarm && typeof alarm.pause === "function") {
        alarm.pause();
      }
    }

    function save() {
      remainingTime = options.readInputSeconds();
      initialTime = remainingTime;
      updateDisplay();
    }

    function pause() {
      if (countdown) {
        clearInterval(countdown);
      }
      countdown = null;
      isRunning = false;
      setExpiredClass(false);
      stopAlarm();
    }

    function reset() {
      if (countdown) {
        clearInterval(countdown);
      }
      countdown = null;
      isRunning = false;
      remainingTime = initialTime;
      soundPlayed = false;
      updateDisplay();
      setExpiredClass(false);
      stopAlarm();
    }

    function restartIfNeeded() {
      if (remainingTime <= 0) {
        remainingTime = options.readInputSeconds();
        initialTime = remainingTime;
        soundPlayed = false;
      }
    }

    async function start() {
      if (isRunning) return;

      stopAlarm();
      setExpiredClass(false);
      restartIfNeeded();

      isRunning = true;
      countdown = window.setInterval(async () => {
        if (remainingTime > 0) {
          remainingTime -= 1;
          updateDisplay();
          return;
        }

        clearInterval(countdown);
        countdown = null;
        isRunning = false;
        if (!soundPlayed) {
          await playAlarm();
          soundPlayed = true;
          setExpiredClass(true);
        }
        options.onComplete?.();
      }, 1000);

      updateDisplay();
    }

    updateDisplay();

    return {
      pause,
      reset,
      save,
      start
    };
  }

  function init() {
    const timer1Min = document.getElementById("timer1min");
    const timer1Sec = document.getElementById("timer1sec");
    const timer2Sec = document.getElementById("timer2sec");
    if (!timer1Min || !timer1Sec || !timer2Sec) {
      return;
    }

    let timer2Runtime;
    const timer1Runtime = createTimerRuntime({
      audioId: "audio_timer1",
      bgmKey: "timer1",
      displayId: "timer",
      fallbackAlarmId: "alarm-sound",
      initialTime: 180,
      onComplete: () => timer2Runtime?.reset(),
      readInputSeconds: () => {
        const minutes = parseInt(document.getElementById("minutes")?.value, 10) || 0;
        const seconds = parseInt(document.getElementById("seconds")?.value, 10) || 0;
        return (minutes * 60) + seconds;
      },
      renderDisplay: (remainingTime) => {
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        timer1Min.textContent = String(minutes).padStart(2, "0");
        timer1Sec.textContent = String(seconds).padStart(2, "0");
      },
      warningId: "one-minute-warning"
    });

    timer2Runtime = createTimerRuntime({
      audioId: "audio_timer2",
      bgmKey: "timer2",
      displayId: "timer2",
      fallbackAlarmId: "alarm-sound2",
      initialTime: 30,
      readInputSeconds: () => parseInt(document.getElementById("seconds2")?.value, 10) || 0,
      renderDisplay: (remainingTime) => {
        timer2Sec.textContent = String(remainingTime).padStart(2, "0");
      }
    });

    windowObject.saveTimeSetting = () => timer1Runtime.save();
    windowObject.startTimer = () => timer1Runtime.start();
    windowObject.pauseTimer = () => timer1Runtime.pause();
    windowObject.resetTimer = () => timer1Runtime.reset();

    windowObject.saveTimeSetting2 = () => timer2Runtime.save();
    windowObject.startTimer2 = () => timer2Runtime.start();
    windowObject.pauseTimer2 = () => timer2Runtime.pause();
    windowObject.resetTimer2 = () => timer2Runtime.reset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}

module.exports = {
  installTimerBridge
};
