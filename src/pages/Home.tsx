import { Link } from 'react-router';
import { useAuth } from '../lib/auth/context';

const PILLARS = [
  {
    title: 'One verified profile',
    body: 'Turn your CV into a structured profile recruiters can actually read.',
  },
  {
    title: 'ATS-ready resume',
    body: 'Generate a clean, parseable PDF tailored to the job you want.',
  },
  {
    title: 'A portfolio that ships',
    body: 'Publish your work at your own public address in minutes.',
  },
];

export default function Home() {
  const auth = useAuth();
  const primaryTo = auth.status === 'authenticated' ? '/dashboard' : '/signup';

  return (
    <div>
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
        <p className="inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-600">
          For job seekers who want to be understood
        </p>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Your career, verified.
        </h1>
        <p className="mt-5 text-lg text-gray-600 max-w-xl mx-auto">
          Turn your CV and GitHub into a professional identity recruiters can understand and verify.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={primaryTo} className="btn btn-primary w-full sm:w-auto">
            {auth.status === 'authenticated' ? 'Go to dashboard' : 'Get started free'}
          </Link>
          {auth.status !== 'authenticated' && (
            <Link to="/login" className="btn btn-secondary w-full sm:w-auto">
              Sign in
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-16 sm:pb-24" aria-label="How it works">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PILLARS.map((pillar, index) => (
            <article key={pillar.title} className="card card-pad">
              <p className="text-xs font-bold text-gray-400">0{index + 1}</p>
              <h2 className="mt-2 text-base font-semibold text-gray-900">{pillar.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
