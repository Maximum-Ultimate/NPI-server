exports.up = function(knex) {
    return knex.schema.createTable('counters', (table) => {
      table.increments('id').primary(); // Unique identifier for each counter
      table.string('counter_name').notNullable(); // Counter name
      table.integer('queues_number').defaultTo(0); // Queues number, default 0
      table.string('status').defaultTo('inactive'); // Status, default 'inactive'
      table.string('remarks').nullable(); // Remarks, optional
      table.timestamps(true, true); // Timestamps: created_at and updated_at
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('counters');
  };
  