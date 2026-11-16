import { useTheme } from "./useTheme";
import Categories from "./Categories";
import DataTools from "./DataTools";

const THEME_LABEL = {
    system: "Automatic (follows your device)",
    light: "Light",
    dark: "Dark",
};

export default function Settings({
    email,
    onSignOut,
}: {
    email: string | null;
    onSignOut: () => void;
}) {
    const { theme, cycle } = useTheme();

    return (
        <>
            <section className="card">
                <h3>Appearance</h3>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <span>{THEME_LABEL[theme]}</span>
                    <button onClick={cycle}>Change</button>
                </div>
            </section>

            <Categories />
            <DataTools />

            <section className="card">
                <h3>Account</h3>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <span
                        className="muted"
                        style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {email ?? "Offline"}
                    </span>
                    <button onClick={onSignOut}>Sign out</button>
                </div>
            </section>

            <p className="muted small center">
                Your data lives on this device and syncs to your account
                whenever you're online.
            </p>
        </>
    );
}
