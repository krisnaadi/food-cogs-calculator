CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE suppliers (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    contact    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingredients (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           TEXT NOT NULL,
    sku            TEXT UNIQUE,
    unit           TEXT NOT NULL,
    price_per_unit NUMERIC(12,4) NOT NULL,
    waste_pct      NUMERIC(5,4) NOT NULL DEFAULT 0,
    supplier_id    UUID REFERENCES suppliers(id),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recipes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    category      TEXT,
    batch_yield   INT NOT NULL DEFAULT 1,
    yield_unit    TEXT NOT NULL DEFAULT 'pcs',
    is_sub_recipe BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recipe_lines (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id     UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id),
    sub_recipe_id UUID REFERENCES recipes(id),
    quantity      NUMERIC(12,4) NOT NULL,
    unit          TEXT NOT NULL,
    CONSTRAINT one_source CHECK (
        (ingredient_id IS NOT NULL AND sub_recipe_id IS NULL) OR
        (ingredient_id IS NULL AND sub_recipe_id IS NOT NULL)
    )
);

CREATE TABLE labor_profiles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role        TEXT NOT NULL,
    hourly_rate NUMERIC(10,2) NOT NULL
);

CREATE TABLE recipe_labor (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id        UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    labor_profile_id UUID NOT NULL REFERENCES labor_profiles(id),
    minutes          NUMERIC(8,2) NOT NULL
);

CREATE TABLE overhead_templates (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name             TEXT NOT NULL,
    packaging_cost   NUMERIC(12,4) NOT NULL DEFAULT 0,
    utilities_cost   NUMERIC(12,4) NOT NULL DEFAULT 0,
    other_fixed      NUMERIC(12,4) NOT NULL DEFAULT 0
);

CREATE TABLE cogs_snapshots (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id        UUID NOT NULL REFERENCES recipes(id),
    overhead_id      UUID REFERENCES overhead_templates(id),
    ingredient_cost  NUMERIC(14,4) NOT NULL,
    labor_cost       NUMERIC(14,4) NOT NULL,
    overhead_cost    NUMERIC(14,4) NOT NULL,
    total_batch_cost NUMERIC(14,4) NOT NULL,
    cost_per_unit    NUMERIC(14,4) NOT NULL,
    suggested_price  NUMERIC(14,4) NOT NULL,
    margin_pct       NUMERIC(5,4) NOT NULL,
    calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE price_history (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id  UUID NOT NULL REFERENCES ingredients(id),
    price_per_unit NUMERIC(12,4) NOT NULL,
    supplier_id    UUID REFERENCES suppliers(id),
    recorded_at    DATE NOT NULL DEFAULT CURRENT_DATE
);