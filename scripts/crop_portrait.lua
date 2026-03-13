-- crop_portrait.lua
-- Crops a portrait image to a square head+shoulders region.
-- Usage: passed via --script-param "input=path,output=path,cropY=0,size=512"

local input  = app.params["input"]
local output = app.params["output"]
local cropY  = tonumber(app.params["cropY"] or "0")
local size   = tonumber(app.params["size"] or "512")

if not input or not output then
  app.alert("Usage: input=<path> output=<path> [cropY=0] [size=512]")
  return
end

local sprite = app.open(input)
if not sprite then
  app.alert("Could not open: " .. input)
  return
end

-- Flatten all layers into one
app.command.FlattenImage()

-- Crop: take a square region from the top of the image
-- x=0, y=cropY, width=sprite.width, height=size (clamped to image height)
local srcW = sprite.width
local srcH = sprite.height
local cropH = math.min(size, srcH - cropY)

-- Resize canvas to the square crop region
sprite:crop(0, cropY, srcW, cropH)

-- Resize to final size x size square
app.command.SpriteSize {
  width  = size,
  height = size,
  scaleX = size / srcW,
  scaleY = size / cropH,
  method = "bilinear",
  lockRatio = false,
}

-- Export to output PNG
sprite:saveCopyAs(output)
sprite:close()

print("Cropped: " .. input .. " -> " .. output)
