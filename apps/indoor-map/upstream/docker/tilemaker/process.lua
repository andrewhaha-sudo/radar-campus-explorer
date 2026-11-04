--[[
Process only indoor OSM data to create layers for rooms, corridors, doors, elevators, etc.
Ignores all other data.
]]--


-- Nodes will only be processed if one of these keys is present

node_keys = { "door" }


-- Assign nodes to a layer, and set attributes, based on OSM tags

function node_function(node)
	-- Doors
	if Find("door") == "yes" then
		Layer("indoor_door", false)
		Attribute("level", Find("level"))
		Attribute("access", Find("access"))
	end
end


-- Assign ways to a layer, and set attributes, based on OSM tags

function way_function()
	-- Indoor data (rooms, corridors, levels, doors, elevators, stairs, etc)
	local indoor = Find("indoor")
	local highway = Find("highway")
	-- Rooms
	if indoor == "room" then
		Layer("indoor_room", IsClosed())
		Attribute("level", Find("level"))
		Attribute("room", Find("room"))
		Attribute("ref", Find("ref"))
		Attribute("name", Find("name"))
	end
	if indoor == "yes" then
		-- Corridors
		-- -> Highway 'corridor' is set and level
		if highway == "corridor" then
			Layer("indoor_corridor", IsClosed())
			Attribute("level", Find("level"))
			Attribute("name", Find("name"))
		end
		-- Elevators
		-- -> Highway 'elevator' is set and level
		if highway == "elevator" then
			Layer("indoor_elevator", IsClosed())
			Attribute("level", Find("level"))
			Attribute("name", Find("name"))
		end
	end
end
