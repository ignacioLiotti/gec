-- Extend certificates with billing and payment metadata
DO $$
BEGIN
    -- Add columns if they do not exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'facturado'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN facturado BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'fecha_facturacion'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN fecha_facturacion DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'nro_factura'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN nro_factura TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'concepto'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN concepto TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'cobrado'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN cobrado BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'observaciones'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN observaciones TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'vencimiento'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN vencimiento DATE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'fecha_pago'
    ) THEN
        ALTER TABLE public.certificates ADD COLUMN fecha_pago DATE;
    END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS certificates_facturado_idx ON public.certificates(facturado);
CREATE INDEX IF NOT EXISTS certificates_cobrado_idx ON public.certificates(cobrado);
CREATE INDEX IF NOT EXISTS certificates_vencimiento_idx ON public.certificates(vencimiento);









