-- create_command_portrait.lua
-- Creates a military command center portrait icon for the "COMMAND" speaker.
-- Output: 512x768 PNG to match other portrait dimensions.

local output = app.params["output"]
if not output then
  output = "portrait_command.png"
end

-- Create new 512x768 sprite (same size as other portraits)
local sprite = Sprite(512, 768)
sprite.filename = output

local img = sprite.cels[1].image

-- ---- Background: very dark navy ----
for y = 0, 767 do
  for x = 0, 511 do
    -- Gradient from dark blue-black at top to dark slate at bottom
    local t = y / 767
    local r = math.floor(5  + t * 8)
    local g = math.floor(10 + t * 15)
    local b = math.floor(25 + t * 30)
    img:putPixel(x, y, Color{ r=r, g=g, b=b, a=255 })
  end
end

-- ---- Outer frame: steel blue border ----
local frameColor  = Color{ r=80,  g=130, b=180, a=255 }
local accentColor = Color{ r=140, g=190, b=230, a=255 }
local goldColor   = Color{ r=200, g=160, b=60,  a=255 }
local whiteColor  = Color{ r=230, g=240, b=255, a=255 }

local function drawRect(image, x1, y1, x2, y2, color)
  for x = x1, x2 do
    image:putPixel(x, y1, color)
    image:putPixel(x, y2, color)
  end
  for y = y1, y2 do
    image:putPixel(x1, y, color)
    image:putPixel(x2, y, color)
  end
end

local function drawFilledRect(image, x1, y1, x2, y2, color)
  for y = y1, y2 do
    for x = x1, x2 do
      image:putPixel(x, y, color)
    end
  end
end

local function drawCircle(image, cx, cy, r, color)
  for angle = 0, 360, 1 do
    local rad = angle * math.pi / 180
    local x = math.floor(cx + r * math.cos(rad))
    local y = math.floor(cy + r * math.sin(rad))
    if x >= 0 and x < 512 and y >= 0 and y < 768 then
      image:putPixel(x, y, color)
    end
  end
end

-- Outer frame (double border)
drawRect(img, 20, 20, 491, 747, frameColor)
drawRect(img, 24, 24, 487, 743, accentColor)

-- Decorative corner brackets
local function cornerBracket(image, ox, oy, sx, sy, color)
  -- sx/sy = ±1 direction
  for i = 0, 40 do
    image:putPixel(ox + sx*i, oy, color)
    image:putPixel(ox, oy + sy*i, color)
  end
  -- Double thickness
  image:putPixel(ox + sx*1, oy + 1*sy, color)
end

cornerBracket(img, 30, 30,  1,  1, goldColor)
cornerBracket(img, 481, 30, -1,  1, goldColor)
cornerBracket(img, 30, 737,  1, -1, goldColor)
cornerBracket(img, 481, 737, -1, -1, goldColor)

-- Central emblem area (dark inset panel)
drawFilledRect(img, 120, 150, 391, 580, Color{r=8, g=15, b=35, a=255})
drawRect(img, 118, 148, 393, 582, frameColor)

-- Central star (5-pointed) drawn as lines
local cx, cy = 256, 365
local outerR, innerR = 90, 36

local starPoints = {}
for i = 0, 9 do
  local angle = (i * 36 - 90) * math.pi / 180
  local r = (i % 2 == 0) and outerR or innerR
  starPoints[i+1] = { x = math.floor(cx + r * math.cos(angle)),
                       y = math.floor(cy + r * math.sin(angle)) }
end

-- Draw star outline (approximate with thick dots)
for i = 1, 10 do
  local p0 = starPoints[i]
  local p1 = starPoints[(i % 10) + 1]
  -- Bresenham-ish line
  local dx = p1.x - p0.x
  local dy = p1.y - p0.y
  local steps = math.max(math.abs(dx), math.abs(dy))
  if steps > 0 then
    for t = 0, steps do
      local x = math.floor(p0.x + dx * t / steps)
      local y = math.floor(p0.y + dy * t / steps)
      -- Draw 2px thick
      for ox = -1, 1 do
        for oy = -1, 1 do
          if x+ox >= 0 and x+ox < 512 and y+oy >= 0 and y+oy < 768 then
            img:putPixel(x+ox, y+oy, goldColor)
          end
        end
      end
    end
  end
end

-- Circle around star
drawCircle(img, cx, cy, 100, frameColor)
drawCircle(img, cx, cy, 102, accentColor)

-- "COMMAND" label area (horizontal bar)
drawFilledRect(img, 80, 610, 431, 660, Color{r=15, g=30, b=60, a=255})
drawRect(img, 78, 608, 433, 662, goldColor)

-- Top classification bar
drawFilledRect(img, 80, 80, 431, 120, Color{r=15, g=30, b=60, a=255})
drawRect(img, 78, 78, 433, 122, goldColor)

-- Scan line effect (horizontal light lines every 8px)
for y = 148, 582, 8 do
  for x = 120, 391 do
    local px = img:getPixel(x, y)
    -- Lighten slightly
    local r = math.min(255, (px >> 16 & 0xFF) + 6)
    local g = math.min(255, (px >> 8  & 0xFF) + 8)
    local b = math.min(255, (px       & 0xFF) + 15)
    img:putPixel(x, y, Color{r=r, g=g, b=b, a=255})
  end
end

-- Save
sprite:saveCopyAs(output)
sprite:close()
print("Created: " .. output)
