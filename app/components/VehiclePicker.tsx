"use client";

import { evModelById, makesFor, MODEL_YEARS, modelsFor, OTHER_MAKE, plugFor, PORT_OPTIONS, RANGE_MAX_MI, RANGE_MIN_MI, type VehicleChoice } from "@/lib/vehicles";

export default function VehiclePicker({ value, onChange }: { value: VehicleChoice; onChange: (next: VehicleChoice) => void }) {
  const other = value.make === OTHER_MAKE;
  const makes = value.year ? makesFor(value.year) : [];
  const models = value.year && value.make && !other ? modelsFor(value.year, value.make) : [];
  const model = value.modelId ? evModelById(value.modelId) : null;
  const askPort = other || (value.make !== "" && value.make !== "Tesla");

  return (
    <fieldset className="vehicle-picker">
      <legend>Your car</legend>

      <div className="vehicle-row">
        <label className="field">
          <span>Year</span>
          <select
            name="year"
            value={value.year ?? ""}
            onChange={(event) => {
              const year = Number(event.target.value) || null;
              // Keep the make when that year has it too, so switching years is quick.
              const keepMake = year && (value.make === OTHER_MAKE || makesFor(year).includes(value.make)) ? value.make : "";
              onChange({ ...value, year, make: keepMake, modelId: null, rangeMi: keepMake === OTHER_MAKE ? value.rangeMi : "" });
            }}
            required={!other}
          >
            <option value="">Year</option>
            {MODEL_YEARS.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Make</span>
          <select
            name="make"
            value={value.make}
            onChange={(event) => onChange({ ...value, make: event.target.value, modelId: null, rangeMi: "" })}
            disabled={!value.year && !other}
            required
          >
            <option value="">Make</option>
            {makes.map((make) => (
              <option key={make} value={make}>{make}</option>
            ))}
            <option value={OTHER_MAKE}>My car isn&apos;t listed</option>
          </select>
        </label>
      </div>

      {!other ? (
        <label className="field">
          <span>Model</span>
          <select
            name="car"
            value={value.modelId ?? ""}
            onChange={(event) => {
              const picked = evModelById(Number(event.target.value));
              onChange({ ...value, modelId: picked?.id ?? null, rangeMi: picked ? String(picked.rangeMi) : "" });
            }}
            disabled={models.length === 0}
            required
          >
            <option value="">{value.make ? "Choose your model" : "Choose year and make first"}</option>
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {item.model} · {item.rangeMi} mi
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {askPort ? (
        <label className="field">
          <span>Charging port</span>
          <select name="port" value={value.port} onChange={(event) => onChange({ ...value, port: event.target.value })} required>
            <option value="">Choose your charging port</option>
            {PORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      ) : null}

      {plugFor(value) === "nacs" ? (
        <label className="check-field">
          <input type="checkbox" name="adapter" value="1" checked={value.ccsAdapter} onChange={(event) => onChange({ ...value, ccsAdapter: event.target.checked })} />
          <span>I carry a CCS adapter, so other networks&apos; chargers work too</span>
        </label>
      ) : null}

      <label className="field">
        <span>Range when full (miles)</span>
        <input
          name="range"
          type="number"
          inputMode="numeric"
          min={RANGE_MIN_MI}
          max={RANGE_MAX_MI}
          value={value.rangeMi}
          onChange={(event) => onChange({ ...value, rangeMi: event.target.value })}
          placeholder={other ? "e.g. 250" : undefined}
          disabled={!other && !model}
          required
        />
      </label>
      {model && String(model.rangeMi) !== value.rangeMi ? (
        <p className="login-note">EPA range for this car: {model.rangeMi} mi.</p>
      ) : model ? (
        <p className="login-note">Official EPA range. Lower it if your battery has aged or you drive fast.</p>
      ) : null}
    </fieldset>
  );
}
