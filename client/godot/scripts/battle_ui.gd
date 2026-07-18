extends Control

signal macro_requested(card_id: String, province_id: String)
signal expansion_armed(card_id: String)
signal duel_submitted(duel_id: String, card_ids: Array)

var public_state: Dictionary = {}
var private_state: Dictionary = {}
var local_player_id := ""
var selected_duel_cards: Array = []
var armed_expansion := false

var mana_label: Label
var duel_label: Label
var target_select: OptionButton
var hand_row: HBoxContainer
var submit_button: Button
var expansion_badge: Label

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_interface()

func _build_interface() -> void:
	var panel := PanelContainer.new()
	panel.name = "BattlePanel"
	panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	panel.position = Vector2(-570, -225)
	panel.size = Vector2(1140, 205)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(panel)

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 12)
	panel.add_child(margin)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	margin.add_child(root)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 14)
	root.add_child(header)

	mana_label = Label.new()
	mana_label.text = "Mana —"
	mana_label.add_theme_font_size_override("font_size", 18)
	header.add_child(mana_label)

	duel_label = Label.new()
	duel_label.text = "Sem duelo ativo"
	duel_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(duel_label)

	expansion_badge = Label.new()
	expansion_badge.text = ""
	expansion_badge.modulate = Color("fef08a")
	header.add_child(expansion_badge)

	target_select = OptionButton.new()
	target_select.custom_minimum_size = Vector2(250, 36)
	header.add_child(target_select)

	submit_button = Button.new()
	submit_button.text = "CONFIRMAR RODADA"
	submit_button.disabled = true
	submit_button.pressed.connect(_submit_duel)
	header.add_child(submit_button)

	hand_row = HBoxContainer.new()
	hand_row.add_theme_constant_override("separation", 8)
	root.add_child(hand_row)

	var help := Label.new()
	help.text = "Macro: selecione uma província e clique na carta. Expansão: clique na carta e depois em dois pilares. Duelo: escolha cartas e confirme."
	help.modulate = Color("94a3b8")
	help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root.add_child(help)

func update_public_state(state: Dictionary, player_id: String) -> void:
	public_state = state
	local_player_id = player_id
	_refresh()

func update_private_state(state: Dictionary) -> void:
	private_state = state
	_refresh()

func consume_expansion() -> bool:
	if not armed_expansion:
		return false
	armed_expansion = false
	expansion_badge.text = ""
	return true

func _refresh() -> void:
	mana_label.text = "Mana %d | HP %d" % [private_state.get("mana", 0), private_state.get("hp", 0)]
	_refresh_targets()
	_refresh_duel()
	_refresh_hand()

func _refresh_targets() -> void:
	target_select.clear()
	var board: Dictionary = public_state.get("board", {})
	for province in board.get("provinces", []):
		var owner := "ALIADA" if province.get("ownerId", "") == local_player_id else "INIMIGA"
		var unit: Dictionary = province.get("unit", {})
		var label := "%s | %s | Nv.%d HP %d" % [
			province.get("id", "província"), owner,
			unit.get("level", 1), unit.get("hp", 0)
		]
		target_select.add_item(label)
		target_select.set_item_metadata(target_select.item_count - 1, province.get("id", ""))
	if target_select.item_count == 0:
		target_select.add_item("Nenhuma província disponível")
		target_select.disabled = true
	else:
		target_select.disabled = false

func _refresh_duel() -> void:
	var duel := _active_duel()
	if duel.is_empty():
		duel_label.text = "Sem duelo ativo"
		submit_button.disabled = true
		selected_duel_cards.clear()
		return
	var combatants: Dictionary = duel.get("combatants", {})
	var mine: Dictionary = combatants.get(local_player_id, {})
	var opponent_id: String = duel.get("defenderId", "") if duel.get("attackerId", "") == local_player_id else duel.get("attackerId", "")
	var opponent: Dictionary = combatants.get(opponent_id, {})
	var submitted: Array = duel.get("submittedPlayerIds", [])
	var already_submitted := local_player_id in submitted
	duel_label.text = "DUELO R%d | Você HP %d Escudo %d Energia %d | Rival HP %d" % [
		duel.get("round", 1), mine.get("hp", 0), mine.get("shield", 0), mine.get("energy", 0), opponent.get("hp", 0)
	]
	submit_button.disabled = already_submitted
	submit_button.text = "AGUARDANDO OPONENTE" if already_submitted else "CONFIRMAR RODADA"

func _refresh_hand() -> void:
	for child in hand_row.get_children():
		child.queue_free()
	var duel := _active_duel()
	var duel_energy := 0
	if not duel.is_empty():
		duel_energy = duel.get("combatants", {}).get(local_player_id, {}).get("energy", 0)
	for card in private_state.get("hand", []):
		var button := Button.new()
		button.custom_minimum_size = Vector2(125, 92)
		button.text = "%s\n%s\nCusto %d" % [card.get("icon", "◈"), card.get("name", "Carta"), card.get("cost", 0)]
		button.tooltip_text = card.get("description", "")
		var card_id: String = card.get("id", "")
		var kind: String = card.get("kind", "")
		if kind == "duel":
			button.toggle_mode = true
			button.button_pressed = card_id in selected_duel_cards
			button.disabled = duel.is_empty() or card.get("cost", 0) > duel_energy
			button.toggled.connect(func(pressed: bool): _toggle_duel_card(card_id, pressed))
		else:
			button.disabled = not duel.is_empty() or card.get("cost", 0) > private_state.get("mana", 0)
			button.pressed.connect(func(): _play_macro(card))
		hand_row.add_child(button)

func _toggle_duel_card(card_id: String, pressed: bool) -> void:
	if pressed and card_id not in selected_duel_cards:
		selected_duel_cards.append(card_id)
	elif not pressed:
		selected_duel_cards.erase(card_id)
	_validate_duel_selection()

func _validate_duel_selection() -> void:
	var duel := _active_duel()
	if duel.is_empty():
		submit_button.disabled = true
		return
	var energy: int = duel.get("combatants", {}).get(local_player_id, {}).get("energy", 0)
	var cost := 0
	for card_id in selected_duel_cards:
		for card in private_state.get("hand", []):
			if card.get("id", "") == card_id:
				cost += card.get("cost", 0)
				break
	var already_submitted := local_player_id in duel.get("submittedPlayerIds", [])
	submit_button.disabled = cost > energy or already_submitted
	submit_button.text = "ENERGIA %d/%d | CONFIRMAR" % [cost, energy]

func _play_macro(card: Dictionary) -> void:
	var card_id: String = card.get("id", "")
	if card.get("effect", "") == "conquest":
		armed_expansion = true
		expansion_badge.text = "EXPANSÃO ARMADA"
		expansion_armed.emit(card_id)
		return
	var province_id := ""
	if target_select.item_count > 0 and not target_select.disabled:
		province_id = str(target_select.get_item_metadata(target_select.selected))
	macro_requested.emit(card_id, province_id)

func _submit_duel() -> void:
	var duel := _active_duel()
	if duel.is_empty():
		return
	duel_submitted.emit(duel.get("id", ""), selected_duel_cards.duplicate())
	selected_duel_cards.clear()

func _active_duel() -> Dictionary:
	for duel in public_state.get("duels", []):
		if duel.get("status", "") == "resolved":
			continue
		if local_player_id in [duel.get("attackerId", ""), duel.get("defenderId", "")]:
			return duel
	return {}
