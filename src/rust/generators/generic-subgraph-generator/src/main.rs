mod generator;
mod models;
mod serialization;
mod tests;

use std::{io::Stdout,
          time::Duration};

use graph_generator_lib::run_graph_generator;
use grapl_config::event_cache;
use grapl_observe::metric_reporter::MetricReporter;
use sqs_lambda::{cache::NopCache,
                 sqs_completion_handler::CompletionPolicy,
                 sqs_consumer::ConsumePolicyBuilder};
use tracing::*;

use crate::{generator::GenericSubgraphGenerator,
            serialization::ZstdJsonDecoder};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env = grapl_config::init_grapl_env!();

    info!("Starting generic-subgraph-generator");

    if env.is_local {
        let generator = GenericSubgraphGenerator::new(NopCache {});

        run_graph_generator(
            generator,
            ZstdJsonDecoder::default(),
            ConsumePolicyBuilder::default(),
            CompletionPolicy::new(
                1,                      // Buffer up to 1 message
                Duration::from_secs(1), // Buffer for up to 1 second
            ),
            MetricReporter::<Stdout>::new("generic-subgraph-generator"),
        )
        .await;
    } else {
        let generator = GenericSubgraphGenerator::new(event_cache().await);

        let completion_policy = ConsumePolicyBuilder::default()
            .with_max_empty_receives(1)
            .with_stop_at(Duration::from_secs(10));

        run_graph_generator(
            generator,
            ZstdJsonDecoder::default(),
            completion_policy,
            CompletionPolicy::new(10, Duration::from_secs(2)),
            MetricReporter::<Stdout>::new("generic-subgraph-generator"),
        )
        .await;
    }

    Ok(())
}
