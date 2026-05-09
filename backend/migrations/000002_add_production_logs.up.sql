CREATE TABLE production_logs (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id             UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    batch_size            INT NOT NULL DEFAULT 1,
    actual_ingredient_cost NUMERIC(14,4) NOT NULL DEFAULT 0,
    actual_yield          NUMERIC(10,2) NOT NULL,
    produced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes                 TEXT
);

CREATE INDEX idx_production_logs_recipe_id ON production_logs(recipe_id);
CREATE INDEX idx_production_logs_produced_at ON production_logs(produced_at DESC);