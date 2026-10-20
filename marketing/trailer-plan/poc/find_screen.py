"""Find a flat mid-grey screen in a plate and print its 4 corners (TL, TR, BR, BL) in plate pixels."""
import sys, json, cv2, numpy as np
img = cv2.imread(sys.argv[1]); h, w = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
v, s = hsv[..., 2].astype(int), hsv[..., 1].astype(int)
mask = ((abs(v - 128) < 30) & (s < 25)).astype(np.uint8) * 255   # neutral, mid-grey
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
c = max(cnts, key=cv2.contourArea)
quad = cv2.approxPolyDP(c, 0.02 * cv2.arcLength(c, True), True).reshape(-1, 2)
if len(quad) != 4:
    quad = cv2.boxPoints(cv2.minAreaRect(c))
pts = sorted(quad.tolist(), key=lambda p: p[1]); top = sorted(pts[:2]); bot = sorted(pts[2:])
corners = [top[0], top[1], bot[1], bot[0]]
# Sub-pixel refinement on the grey/bezel edge
ref = cv2.cornerSubPix(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), np.float32(corners).reshape(-1, 1, 2), (7, 7), (-1, -1),
                       (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.01)).reshape(-1, 2)
print(json.dumps({"size": [w, h], "quad": ref.round(1).tolist(), "areaFraction": round(cv2.contourArea(c) / (w * h), 3)}))
