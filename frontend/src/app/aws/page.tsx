import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AWS Region Connectivity & Status',
    description: 'Check connectivity from your location to AWS Datacenters worldwide. Tests latency to all AWS regions.',
    openGraph: {
        title: 'AWS Region Connectivity & Status',
        description: 'Check connectivity from your location to AWS Datacenters worldwide.',
    },
};

export default function AWSPage() {
    return (
        <iframe
            src="/aws/index.html"
            style={{
                width: '100%',
                height: '100vh',
                border: 'none',
                margin: 0,
                padding: 0,
            }}
            title="AWS Region Connectivity & Status"
        />
    );
}
