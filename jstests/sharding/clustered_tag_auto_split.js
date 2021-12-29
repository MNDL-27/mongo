/*
 * Test to make sure that tag ranges get split when full keys are used for the tag ranges and the
 * collection is clustered by _id.
 *
 * TODO SERVER-61501: Evaluate whether this test should be removed.
 *
 * @tags: [
 *   requires_fcv_52,
 *   featureFlagClusteredIndexes,
 * ]
 */

(function() {
'use strict';

load("jstests/sharding/libs/find_chunks_util.js");

var s = new ShardingTest({shards: 2, mongos: 1});

assert.commandWorked(s.s0.adminCommand({enablesharding: "test"}));
s.ensurePrimaryShard('test', s.shard1.shardName);

assert.commandWorked(
    s.s0.getDB("test").createCollection("foo", {clusteredIndex: {key: {_id: 1}, unique: true}}));

assert.commandWorked(s.s0.adminCommand({shardcollection: "test.foo", key: {_id: 1}}));

assert.eq(1, findChunksUtil.findChunksByNs(s.config, "test.foo").itcount());

s.addShardTag(s.shard0.shardName, "a");
s.addShardTag(s.shard0.shardName, "b");

s.addTagRange("test.foo", {_id: 5}, {_id: 10}, "a");
s.addTagRange("test.foo", {_id: 10}, {_id: 15}, "b");

s.startBalancer();

assert.soon(function() {
    return findChunksUtil.findChunksByNs(s.config, "test.foo").itcount() == 4;
}, 'Split did not occur', 3 * 60 * 1000);

s.awaitBalancerRound();
s.printShardingStatus(true);
assert.eq(4, findChunksUtil.findChunksByNs(s.config, "test.foo").itcount(), 'Split points changed');

assert.eq(1, findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: MinKey}}).itcount());
assert.eq(1, findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: 5}}).itcount());
assert.eq(1, findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: 10}}).itcount());
assert.eq(1, findChunksUtil.findChunksByNs(s.config, "test.foo", {min: {_id: 15}}).itcount());

s.stop();
})();