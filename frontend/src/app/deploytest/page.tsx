export default function DeployTestPage() {
    return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅ Deploy Test</h1>
            <p style={{ fontSize: '1.2rem', color: '#666' }}>
                If you can see this page, the deployment pipeline is working correctly.
            </p>
            <p style={{ marginTop: '1rem', color: '#999' }}>
                Deployed at: {new Date().toISOString()}
            </p>
        </div>
    );
}
