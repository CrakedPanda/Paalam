
#include <Arduino.h>
#include <BluetoothSerial.h>
#include <TFT_eSPI.h>
#include <ESP_I2S.h>

#if !defined(CONFIG_BT_SPP_ENABLED)
#error Bluetooth Classic SPP is required
#endif

// PAALAM V5
// BRAILLE + BLUETOOTH SPEECH TO TEXT

BluetoothSerial SerialBT;
TFT_eSPI tft;
I2SClass mic;

// Braille sensors, dots 1 to 6
const uint8_t DOT_PINS[6] = {
  13, 12, 14, 27, 26, 25
};

// Control buttons
#define BTN_MODE 32
#define BTN_SPACE 33
#define BTN_BACK 16

// INMP441
#define MIC_BCLK 21
#define MIC_WS 22
#define MIC_DIN 34

// Audio format
#define SAMPLE_RATE 16000
#define RECORD_SECONDS 2
#define AUDIO_FRAMES 128

const size_t TOTAL_SAMPLES =
  SAMPLE_RATE * RECORD_SECONDS;

const size_t AUDIO_BYTES =
  TOTAL_SAMPLES * sizeof(int16_t);

// Input timing
const unsigned long DEBOUNCE_MS = 40;
const unsigned long RELEASE_MS = 200;

// System state
enum Mode {
  KEYBOARD_MODE,
  MICROPHONE_MODE
};

Mode currentMode = KEYBOARD_MODE;

String typedText = "";
String speechText = "";

uint8_t collectedDots = 0;
bool collecting = false;
bool ignoreUntilRelease = false;
unsigned long lastTouch = 0;

// Button state
struct Button {
  uint8_t pin;
  bool lastRaw;
  bool stable;
  unsigned long changedAt;
};

Button modeBtn = {BTN_MODE, HIGH, HIGH, 0};
Button spaceBtn = {BTN_SPACE, HIGH, HIGH, 0};
Button backBtn = {BTN_BACK, HIGH, HIGH, 0};

// =====================================
// BUTTON DEBOUNCE
// =====================================

bool wasPressed(Button &b) {
  bool reading = digitalRead(b.pin);
  unsigned long now = millis();

  if (reading != b.lastRaw) {
    b.lastRaw = reading;
    b.changedAt = now;
  }

  if (now - b.changedAt >= DEBOUNCE_MS) {
    if (reading != b.stable) {
      b.stable = reading;
      return reading == LOW;
    }
  }

  return false;
}

// =====================================
// BRAILLE DECODER
// =====================================

char decodeBraille(uint8_t p) {
  switch (p) {
    case 0b000001: return 'A';
    case 0b000011: return 'B';
    case 0b001001: return 'C';
    case 0b011001: return 'D';
    case 0b010001: return 'E';
    case 0b001011: return 'F';
    case 0b011011: return 'G';
    case 0b010011: return 'H';
    case 0b001010: return 'I';
    case 0b011010: return 'J';

    case 0b000101: return 'K';
    case 0b000111: return 'L';
    case 0b001101: return 'M';
    case 0b011101: return 'N';
    case 0b010101: return 'O';
    case 0b001111: return 'P';
    case 0b011111: return 'Q';
    case 0b010111: return 'R';
    case 0b001110: return 'S';
    case 0b011110: return 'T';

    case 0b100101: return 'U';
    case 0b100111: return 'V';
    case 0b111010: return 'W';
    case 0b101101: return 'X';
    case 0b111101: return 'Y';
    case 0b110101: return 'Z';

    case 0b000010: return ',';
    case 0b110010: return '.';
    case 0b100110: return '?';
    case 0b010110: return '!';

    default: return '\0';
  }
}

uint8_t readBraille() {
  uint8_t pattern = 0;

  for (int i = 0; i < 6; i++) {
    if (digitalRead(DOT_PINS[i]) == HIGH) {
      pattern |= (1 << i);
    }
  }

  return pattern;
}

// =====================================
// TFT DISPLAY
// =====================================

void showStatus(const String &message) {
  tft.fillRect(0, 201, 320, 24, TFT_BLACK);

  tft.setTextSize(1);
  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.setCursor(8, 207);
  tft.print(message.substring(0, 50));
}

void displayText(const String &message) {
  tft.fillRect(6, 76, 308, 123, TFT_BLACK);

  tft.setTextSize(2);
  tft.setTextWrap(false);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);

  if (message.length() == 0) {
    tft.setCursor(10, 90);

    if (currentMode == KEYBOARD_MODE) {
      tft.print("Ready to type...");
    } else {
      tft.print("Press SPACE");
      tft.setCursor(10, 115);
      tft.print("to record voice");
    }

    return;
  }

  const int CHARS_PER_LINE = 24;
  const int MAX_VISIBLE = 144;

  int start = 0;

  if (message.length() > MAX_VISIBLE) {
    start = message.length() - MAX_VISIBLE;
  }

  int col = 0;
  int row = 0;

  for (int i = start; i < message.length(); i++) {
    if (col >= CHARS_PER_LINE) {
      col = 0;
      row++;
    }

    if (row >= 6) break;

    tft.setCursor(
      10 + col * 12,
      78 + row * 20
    );

    tft.print(message[i]);
    col++;
  }
}

void drawScreen() {
  tft.fillScreen(TFT_BLACK);

  // Header
  tft.fillRect(0, 0, 320, 40, TFT_BLUE);

  tft.setTextSize(3);
  tft.setTextColor(TFT_WHITE, TFT_BLUE);
  tft.setCursor(99, 9);
  tft.print("PAALAM");

  // Mode title
  tft.setTextSize(2);
  tft.setTextColor(TFT_CYAN, TFT_BLACK);
  tft.setCursor(10, 50);

  if (currentMode == KEYBOARD_MODE) {
    tft.print("BRAILLE KEYBOARD");
  } else {
    tft.print("SPEECH TO TEXT");
  }

  tft.drawFastHLine(
    10, 73, 300, TFT_DARKGREY
  );

  if (currentMode == KEYBOARD_MODE) {
    displayText(typedText);
    showStatus("BRAILLE INPUT READY");
  } else {
    displayText(speechText);

    if (SerialBT.hasClient()) {
      showStatus("BLUETOOTH CONNECTED");
    } else {
      showStatus("WAITING FOR LAPTOP");
    }
  }

  tft.setTextSize(1);
  tft.setTextColor(TFT_DARKGREY, TFT_BLACK);
  tft.setCursor(8, 230);

  if (currentMode == KEYBOARD_MODE) {
    tft.print("MODE:32  SPACE:33  BACK:16");
  } else {
    tft.print("MODE:32  RECORD:33");
  }
}

// =====================================
// BRAILLE TEXT FUNCTIONS
// =====================================

void appendCharacter(char c) {
  if (typedText.length() >= 255) return;

  typedText += c;

  Serial.print("PAALAM TEXT: ");
  Serial.println(typedText);

  displayText(typedText);
}

void cancelChord() {
  collecting = false;
  collectedDots = 0;
  ignoreUntilRelease = (readBraille() != 0);
}

void processBraille() {
  uint8_t live = readBraille();
  unsigned long now = millis();

  if (ignoreUntilRelease) {
    if (live == 0) {
      ignoreUntilRelease = false;
    }
    return;
  }

  if (live != 0) {
    if (!collecting) {
      collecting = true;
      collectedDots = 0;
    }

    uint8_t newDots = collectedDots | live;

    if (newDots != collectedDots) {
      collectedDots = newDots;

      String status = "DOTS: ";

      for (int i = 0; i < 6; i++) {
        if (collectedDots & (1 << i)) {
          status += String(i + 1) + " ";
        }
      }

      showStatus(status);
    }

    lastTouch = now;

  } else if (collecting) {
    if (now - lastTouch >= RELEASE_MS) {
      uint8_t pattern = collectedDots;

      collecting = false;
      collectedDots = 0;

      char letter = decodeBraille(pattern);

      if (letter != '\0') {
        appendCharacter(letter);
        showStatus(String("LETTER: ") + letter);
      } else {
        showStatus("Unknown Braille pattern");
      }
    }
  }
}

// =====================================
// MICROPHONE RECORDING
// =====================================


bool recordAudio(int16_t *samples) {

  Serial.println("Starting microphone...");
  Serial.printf("Free heap: %u bytes\n",
                ESP.getFreeHeap());

  showStatus("STARTING MICROPHONE...");

  mic.setPins(
    MIC_BCLK,
    MIC_WS,
    -1,
    MIC_DIN
  );

  bool started = mic.begin(
    I2S_MODE_STD,
    SAMPLE_RATE,
    I2S_DATA_BIT_WIDTH_32BIT,
    I2S_SLOT_MODE_STEREO
  );

  if (!started) {
    Serial.printf("I2S INIT FAILED! Error: %d\n",
                  mic.lastError());

    showStatus("I2S INIT FAILED");
    return false;
  }

  Serial.println("I2S STARTED SUCCESSFULLY");

  delay(100);

  showStatus("RECORDING - SPEAK NOW!");
  Serial.println("Recording started...");

  int32_t raw[AUDIO_FRAMES * 2];

  size_t captured = 0;
  unsigned long startTime = millis();
  unsigned long lastProgress = millis();

  uint32_t emptyReads = 0;

  while (captured < TOTAL_SAMPLES) {

    // Stop if recording takes too long
    if (millis() - startTime > 12000UL) {
      Serial.println("Recording timeout!");
      break;
    }

    size_t bytesRead = mic.readBytes(
      (char*)raw,
      sizeof(raw)
    );

    if (bytesRead < 8) {
      emptyReads++;
      delay(2);
      continue;
    }

    size_t frames = bytesRead / 8;

    for (size_t i = 0;
         i < frames && captured < TOTAL_SAMPLES;
         i++) {

      samples[captured++] =
        (int16_t)(raw[i * 2] >> 16);
    }

    // Show progress once per second
    if (millis() - lastProgress >= 1000) {

      Serial.printf(
        "Captured: %u / %u samples\n",
        (unsigned)captured,
        (unsigned)TOTAL_SAMPLES
      );

      lastProgress = millis();
    }

    delay(1);
  }

  mic.end();

  Serial.println("Recording finished");

  Serial.printf(
    "Final samples: %u / %u\n",
    (unsigned)captured,
    (unsigned)TOTAL_SAMPLES
  );

  Serial.printf(
    "Empty reads: %u\n",
    (unsigned)emptyReads
  );

  if (captured != TOTAL_SAMPLES) {
    showStatus("AUDIO CAPTURE FAILED");
    return false;
  }

  Serial.println("AUDIO CAPTURE SUCCESS!");
  showStatus("AUDIO RECORDED!");

  return true;
}

// =====================================
// BLUETOOTH BINARY TRANSFER
// =====================================

bool sendAudio(const int16_t *samples) {

  if (!SerialBT.hasClient()) {
    showStatus("LAPTOP NOT CONNECTED");
    return false;
  }

  Serial.println("Sending audio over Bluetooth...");
  showStatus("SENDING AUDIO...");

  // Tell Python exactly how many bytes follow
  SerialBT.print("AUDIO ");
  SerialBT.print(SAMPLE_RATE);
  SerialBT.print(" ");
  SerialBT.println((unsigned long)AUDIO_BYTES);

  const uint8_t *bytes =
    (const uint8_t*)samples;

  size_t offset = 0;

  while (offset < AUDIO_BYTES) {

    if (!SerialBT.hasClient()) {
      showStatus("BLUETOOTH DISCONNECTED");
      return false;
    }

    size_t chunk = AUDIO_BYTES - offset;

    if (chunk > 512) {
      chunk = 512;
    }

    int retries = 0;

    while (SerialBT.write(
        bytes + offset, chunk) != chunk) {

      if (!SerialBT.hasClient() || ++retries > 100) {
        showStatus("AUDIO SEND FAILED");
        return false;
      }

      delay(50);
    }

    offset += chunk;
    delay(5);
  }

  Serial.println("Audio transfer queued!");
  showStatus("WAITING FOR SPEECH TEXT");

  return true;
}

// =====================================
// RECEIVE TRANSCRIBED TEXT
// =====================================

bool waitForTranscript(String &result) {

  result = "";
  String line = "";

  unsigned long start = millis();

  while (millis() - start < 90000UL) {

    if (!SerialBT.hasClient()) {
      showStatus("BLUETOOTH LOST");
      return false;
    }

    while (SerialBT.available()) {

      char c = (char)SerialBT.read();

      if (c == '\n') {

        line.trim();

        if (line.startsWith("TXT:")) {
          result = line.substring(4);
          result.trim();
          return true;
        }

        if (line.startsWith("ERR:")) {
          Serial.println(line);
          showStatus("SPEECH SERVER ERROR");
          return false;
        }

        line = "";

      } else if (c != '\r') {

        if (line.length() < 400) {
          line += c;
        }
      }
    }

    delay(10);
  }

  showStatus("TRANSCRIPTION TIMEOUT");
  return false;
}

// =====================================
// SPEECH RECOGNITION ACTION
// =====================================

void startSpeechRecognition() {

  if (!SerialBT.hasClient()) {
    showStatus("CONNECT LAPTOP FIRST");
    return;
  }

  Serial.print("Free heap: ");
  Serial.println(ESP.getFreeHeap());

  // 3 seconds = 96 KB of 16-bit mono PCM.
  // Record first, send second. This avoids
  // Bluetooth delays interfering with I2S.
  int16_t *audio =
    (int16_t*)malloc(AUDIO_BYTES);

  if (audio == nullptr) {
    Serial.println("Not enough audio buffer memory");
    showStatus("LOW MEMORY: TRY 2 SEC");
    return;
  }

  bool recorded = recordAudio(audio);

  if (!recorded) {
    free(audio);
    showStatus("AUDIO CAPTURE FAILED");
    return;
  }

  bool sent = sendAudio(audio);

  free(audio);

  if (!sent) return;

  String result;

  if (!waitForTranscript(result)) {
    return;
  }

  if (result.length() == 0) {
    result = "NO SPEECH DETECTED";
  }

  speechText = result;
  displayText(speechText);

  Serial.print("RECOGNIZED SPEECH: ");
  Serial.println(speechText);

  if (speechText == "NO SPEECH DETECTED") {
    showStatus("TRY SPEAKING AGAIN");
    return;
  }

  // Preserve speech in the Braille message
  if (typedText.length() > 0 &&
      !typedText.endsWith(" ")) {
    typedText += " ";
  }

  typedText += speechText;

  if (typedText.length() > 255) {
    typedText = typedText.substring(
      typedText.length() - 255
    );
  }

  showStatus("SPEECH CONVERTED TO TEXT!");
}

// =====================================
// MODE SWITCH
// =====================================

void toggleMode() {

  cancelChord();

  if (currentMode == KEYBOARD_MODE) {
    currentMode = MICROPHONE_MODE;
    Serial.println("MICROPHONE MODE");
  } else {
    currentMode = KEYBOARD_MODE;
    Serial.println("KEYBOARD MODE");
  }

  drawScreen();
}

// =====================================
// BUTTON HANDLING
// =====================================

void sendTypedTextToLaptop() {

  if (typedText.length() == 0) {
    showStatus("NOTHING TO SPEAK");
    return;
  }

  if (!SerialBT.hasClient()) {
    Serial.println("Bluetooth not connected!");
    showStatus("CONNECT LAPTOP FIRST");
    return;
  }

  // SAY: is our text-to-speech command
  SerialBT.print("SAY:");
  SerialBT.println(typedText);

  Serial.print("SENT FOR SPEECH: ");
  Serial.println(typedText);

  showStatus("TEXT SENT TO LAPTOP!");
}


void processButtons() {

  bool modePressed = wasPressed(modeBtn);
  bool backPressed = wasPressed(backBtn);

  // Update debounced Space button state
  wasPressed(spaceBtn);

  static bool spaceWasDown = false;
  static unsigned long spaceDownAt = 0;

  bool spaceDown = (spaceBtn.stable == LOW);

  if (spaceDown && !spaceWasDown) {
    spaceDownAt = millis();
  }

  bool spaceReleased = spaceWasDown && !spaceDown;
  unsigned long heldMs = millis() - spaceDownAt;

  spaceWasDown = spaceDown;

  // MODE BUTTON
  if (modePressed) {
    toggleMode();
    return;
  }

  // MICROPHONE MODE
  if (currentMode == MICROPHONE_MODE) {

    if (spaceReleased) {
      startSpeechRecognition();
    }

    return;
  }

  // KEYBOARD MODE
  if (spaceReleased) {

    cancelChord();

    if (heldMs >= 1200) {

      // Long press: speak full sentence
      sendTypedTextToLaptop();

    } else {

      // Short press: normal space
      appendCharacter(' ');
    }
  }

  // BACKSPACE
  if (backPressed) {

    cancelChord();

    if (typedText.length() > 0) {
      typedText.remove(typedText.length() - 1);
    }

    displayText(typedText);

    Serial.print("PAALAM TEXT: ");
    Serial.println(typedText);
  }
}

// =====================================
// SETUP
// =====================================

void setup() {

  Serial.begin(115200);
  delay(500);

  for (int i = 0; i < 6; i++) {
    pinMode(DOT_PINS[i], INPUT);
  }

  pinMode(BTN_MODE, INPUT_PULLUP);
  pinMode(BTN_SPACE, INPUT_PULLUP);
  pinMode(BTN_BACK, INPUT_PULLUP);

  ignoreUntilRelease = (readBraille() != 0);

  tft.init();
  tft.setRotation(1);

  currentMode = KEYBOARD_MODE;
  drawScreen();

  // Disable Wi-Fi: Bluetooth Classic only
  if (!SerialBT.begin("PAALAM_ESP32")) {
    Serial.println("Bluetooth startup FAILED");
    showStatus("BLUETOOTH ERROR");
  } else {
    Serial.println("Bluetooth ready: PAALAM_ESP32");
  }

  Serial.println("==========================");
  Serial.println("PAALAM V5");
  Serial.println("BLUETOOTH SPEECH TO TEXT");
  Serial.println("==========================");
}

// =====================================
// MAIN LOOP
// =====================================

void loop() {

  processButtons();

  if (currentMode == KEYBOARD_MODE) {
    processBraille();
  }

  delay(2);
}
