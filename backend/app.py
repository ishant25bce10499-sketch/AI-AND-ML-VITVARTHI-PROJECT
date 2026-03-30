from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import cv2
import base64
import random

app = Flask(__name__)
CORS(app, origins="*")

try:
    from ultralytics import YOLO
    model = YOLO("yolov8n.pt") 
    YOLO_AVAILABLE = True
    print("[INFO] YOLOv8 loaded.")
except ImportError:
    YOLO_AVAILABLE = False
    print("[WARN] Ultralytics not installed — running in mock mode.")

FINDABLE_OBJECTS = [
    "bottle", "chair", "book", "laptop", "cup", "cell phone",
    "keyboard", "mouse", "remote", "clock", "scissors",
    "backpack", "umbrella", "toothbrush"
]

@app.route("/api/get-task", methods=["GET"])
def get_task():
    task = random.choice(FINDABLE_OBJECTS)
    return jsonify({"task": task})

@app.route("/api/verify", methods=["POST"])
def verify_object():
    data = request.get_json()
    if not data or "image" not in data or "task" not in data:
        return jsonify({"success": False, "message": "Missing data."}), 400

    task = data["task"].lower().strip()
    image_data = data["image"]
    if "," in image_data:
        image_data = image_data.split(",")[1]

    try:
        img_bytes = base64.b64decode(image_data)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"success": False, "message": "Could not decode image."}), 400
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

    if not YOLO_AVAILABLE:
        detected = random.random() > 0.3
        return jsonify({
            "success": detected,
            "detected_objects": [task] if detected else ["unknown"],
            "message": "Task completed! [DEV MODE]" if detected else "Not found. Try again! [DEV MODE]"
        })

    results = model(img, conf=0.4)
    detected_names = []
    for result in results:
        for box in result.boxes:
            cid = int(box.cls[0])
            detected_names.append(model.names[cid].lower())

    task_found = task in detected_names
    return jsonify({
        "success": task_found,
        "detected_objects": list(set(detected_names)),
        "message": "Alarm dismissed! Great job! 🎉" if task_found
                   else f"'{task.capitalize()}' not found. Try again!"
    })

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "yolo": YOLO_AVAILABLE})

if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))