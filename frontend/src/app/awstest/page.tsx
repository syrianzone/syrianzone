import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AWS Region Connectivity & Status',
    description: 'Check connectivity from your location to AWS Datacenters worldwide. Tests latency to all AWS regions.',
    openGraph: {
        title: 'AWS Region Connectivity & Status',
        description: 'Check connectivity from your location to AWS Datacenters worldwide.',
    },
};

export default function AWSTestPage() {
    return (
        <iframe
            src="/awstest/index.html"
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
