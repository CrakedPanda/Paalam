
import serial
import time
import numpy as np
import pyttsx3
from faster_whisper import WhisperModel

# ==========================================
# PAALAM - LAPTOP COMMUNICATION MODULE
# BLUETOOTH + SPEECH TO TEXT + TEXT TO SPEECH
# ==========================================

# CHANGE THIS TO YOUR WORKING BLUETOOTH PORT
PORT = "COM12"

BAUD_RATE = 115200

SAMPLE_RATE = 16000

# ==========================================
# INITIALIZE TEXT TO SPEECH
# ==========================================

print("Initializing PAALAM voice output...")

speaker = pyttsx3.init("sapi5")

speaker.setProperty("rate", 165)
speaker.setProperty("volume", 1.0)

print("Text-to-Speech ready!")


# ==========================================
# INITIALIZE WHISPER
# ==========================================

print("Loading Whisper speech recognition...")

model = WhisperModel(
    "tiny.en",
    device="cpu",
    compute_type="int8"
)

print("Speech-to-Text ready!")


# ==========================================
# SPEAK TEXT THROUGH LAPTOP
# ==========================================

def speak_text(text):

    text = text.strip()

    if not text:
        print("No text to speak.")
        return

    print()
    print("================================")
    print("PAALAM TEXT RECEIVED")
    print("================================")

    print("Message:", text)

    print("Speaking through laptop...")

    speaker.say(text)
    speaker.runAndWait()

    print("Speech completed!")
    print()


# ==========================================
# RECEIVE EXACT AMOUNT OF AUDIO DATA
# ==========================================

def receive_audio(bt, byte_count):

    audio_data = bytearray()

    last_progress = time.monotonic()

    print(
        f"Receiving {byte_count} bytes of audio..."
    )

    while len(audio_data) < byte_count:

        remaining = byte_count - len(audio_data)

        chunk = bt.read(
            min(4096, remaining)
        )

        if chunk:

            audio_data.extend(chunk)

            last_progress = time.monotonic()

        else:

            if time.monotonic() - last_progress > 30:
                raise TimeoutError(
                    "Audio transfer timed out"
                )

    print(
        f"Audio received: {len(audio_data)} bytes"
    )

    return bytes(audio_data)


# ==========================================
# CONVERT AUDIO TO TEXT
# ==========================================

def speech_to_text(raw_audio, sample_rate):

    if sample_rate != SAMPLE_RATE:
        raise ValueError(
            "Unsupported audio sample rate"
        )

    if len(raw_audio) % 2 != 0:
        raise ValueError(
            "Invalid 16-bit PCM audio length"
        )

    # Convert raw PCM to float audio
    audio = np.frombuffer(
        raw_audio,
        dtype="<i2"
    ).astype(np.float32) / 32768.0

    if audio.size == 0:
        return "NO SPEECH DETECTED"

    # Calculate microphone level
    rms = float(
        np.sqrt(np.mean(audio * audio))
    )

    print()
    print("Audio RMS:", round(rms, 5))

    if rms < 0.001:

        print("No significant audio detected.")

        return "NO SPEECH DETECTED"

    print("Whisper is processing speech...")

    # Speech recognition
    segments, info = model.transcribe(
        audio,
        language="en",
        beam_size=1,
        vad_filter=False,
        condition_on_previous_text=False
    )

    recognized_text = " ".join(
        segment.text.strip()
        for segment in segments
    ).strip()

    # Convert to uppercase ASCII
    # for the ESP32 TFT display
    recognized_text = recognized_text.encode(
        "ascii",
        errors="ignore"
    ).decode().upper()

    if not recognized_text:

        return "NO SPEECH DETECTED"

    return recognized_text


# ==========================================
# SEND RECOGNIZED TEXT TO ESP32
# ==========================================

def send_text_to_esp32(bt, text):

    # Keep it to one serial line
    text = " ".join(text.split())

    # Limit message size
    text = text[:240]

    message = "TXT:" + text + "\n"

    bt.write(
        message.encode(
            "ascii",
            errors="replace"
        )
    )

    bt.flush()

    print()
    print("================================")
    print("SPEECH RECOGNITION RESULT")
    print("================================")

    print("Recognized:", text)

    print("Text sent to ESP32!")
    print()


# ==========================================
# HANDLE ESP32 BLUETOOTH MESSAGES
# ==========================================

def process_message(bt, line):

    line = line.strip()

    if not line:
        return

    # --------------------------------------
    # CASE 1: BRAILLE TEXT TO SPEECH
    # --------------------------------------

    if line.startswith("SAY:"):

        text = line[4:]

        speak_text(text)

        return

    # --------------------------------------
    # CASE 2: MICROPHONE SPEECH TO TEXT
    # --------------------------------------

    if line.startswith("AUDIO "):

        parts = line.split()

        if len(parts) != 3:

            print("Invalid audio header:", line)

            bt.write(
                b"ERR:INVALID AUDIO HEADER\n"
            )

            return

        try:

            sample_rate = int(parts[1])

            audio_bytes = int(parts[2])

        except ValueError:

            print("Invalid audio parameters.")

            bt.write(
                b"ERR:INVALID AUDIO HEADER\n"
            )

            return

        if (
            sample_rate != SAMPLE_RATE
            or audio_bytes < 2
            or audio_bytes > 200000
            or audio_bytes % 2 != 0
        ):

            print("Unsupported audio format.")

            bt.write(
                b"ERR:UNSUPPORTED AUDIO FORMAT\n"
            )

            return

        print()
        print("================================")
        print("MICROPHONE AUDIO RECEIVED")
        print("================================")

        # Receive binary audio payload
        raw_audio = receive_audio(
            bt,
            audio_bytes
        )

        # Run Whisper transcription
        recognized_text = speech_to_text(
            raw_audio,
            sample_rate
        )

        # Return result to ESP32
        send_text_to_esp32(
            bt,
            recognized_text
        )

        return

    # --------------------------------------
    # OTHER SERIAL MESSAGES
    # --------------------------------------

    print("ESP32:", line)


# ==========================================
# MAIN BLUETOOTH LOOP
# ==========================================

def main():

    print()
    print("===================================")
    print("         PAALAM SYSTEM")
    print("===================================")

    print("Bluetooth:", PORT)
    print("Baud rate:", BAUD_RATE)

    print()
    print("Connecting to PAALAM ESP32...")

    try:

        with serial.Serial(
            PORT,
            BAUD_RATE,
            timeout=1,
            write_timeout=10
        ) as bt:

            print()
            print("BLUETOOTH CONNECTED!")

            print()
            print("===================================")
            print("PAALAM COMMUNICATION READY")
            print("===================================")

            print()
            print("Available functions:")

            print("1. Braille Text -> Laptop Speech")
            print("2. Microphone -> Speech Recognition")
            print("3. Recognized Text -> ESP32 TFT")

            print()
            print("Waiting for PAALAM messages...")
            print()

            while True:

                try:

                    # Receive one protocol header
                    header = bt.readline()

                    if not header:
                        continue

                    line = header.decode(
                        "ascii",
                        errors="replace"
                    ).strip()

                    process_message(
                        bt,
                        line
                    )

                except TimeoutError as e:

                    print("Bluetooth transfer error:", e)

                    # Binary payload is incomplete.
                    # Reopen the connection to resync.
                    break

                except serial.SerialException:
                    raise

                except Exception as e:

                    print("Processing error:", e)

                    try:
                        bt.write(
                            b"ERR:PROCESSING FAILED\n"
                        )

                    except serial.SerialException:
                        raise

    except serial.SerialException as e:

        print()
        print("BLUETOOTH ERROR:", e)

        print()
        print("Check the following:")
        print("- ESP32 is powered on")
        print("- Bluetooth is paired")
        print("- Correct COM port is selected")
        print("- No other app is using the port")

    except KeyboardInterrupt:

        print()
        print("PAALAM stopped by user.")

    finally:

        try:
            speaker.stop()
        except Exception:
            pass


# ==========================================
# START PROGRAM
# ==========================================

if __name__ == "__main__":
    main()
